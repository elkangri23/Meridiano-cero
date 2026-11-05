import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { createHash } from 'node:crypto';

describe('Registro público (Fase B)', () => {
  const base = readAppConfig(process.env);
  // Registro activado pero sin sesión local: así se comporta producción.
  const config = { ...base, registrationEnabled: true, localAuth: false };
  const database = createDatabase(config.databaseUrl);
  const app = createApp({ config, database });
  const origin = config.origin;
  const emailA = 'prueba-a@sintetico.invalid';
  const emailB = 'prueba-b@sintetico.invalid';
  const passwordA = 'contraseña-sintética-A-123';
  const passwordB = 'contraseña-sintética-B-123';
  let cookieA = '';
  let csrfA = '';
  let profileA = '';

  function headers(extra: Record<string, string> = {}) {
    return { origin, ...extra };
  }
  async function register(email: string, password: string, displayName: string) {
    return app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: headers(), payload: { email, displayName, password } });
  }

  beforeAll(async () => {
    const url = readDatabaseUrl(process.env.DATABASE_MIGRATION_URL);
    await migrate(url);
    await app.ready();
  });
  afterAll(async () => {
    // Limpieza con la conexión del propietario: el rol de la app no puede
    // borrar perfiles (sin DELETE sobre profiles por diseño).
    const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    try {
      await owner.pool.query('DELETE FROM sessions USING profiles WHERE sessions.profile_id = profiles.id AND profiles.local_key IN ($1, $2)', [emailA, emailB]);
      await owner.pool.query('DELETE FROM profiles WHERE local_key IN ($1, $2)', [emailA, emailB]);
      await owner.pool.query('DELETE FROM profiles WHERE local_key LIKE $1', ['deleted:%']);
    } finally {
      await owner.pool.end();
    }
    await app.close();
    await database.pool.end();
  });

  it('el bypass de sesión local no existe con localAuth desactivado', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/local-session', headers: headers(), payload: {} })).statusCode).toBe(404);
  });
  it('registro rechaza origen distinto', async () => {
    expect((await register(emailA, passwordA, 'Detective A')).statusCode).toBe(200);
    const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: { origin: 'http://malicioso.invalid' }, payload: { email: emailB, displayName: 'Detective B', password: passwordB } });
    expect(bad.statusCode).toBe(403);
  });
  it('registro guarda hash Argon2id, crea token de verificación y abre sesión', async () => {
    const response = await register(emailB, passwordB, 'Detective B');
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.profile.emailVerified).toBe(false);
    expect(body.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const header = response.headers['set-cookie'];
    if (typeof header !== 'string') throw new Error('Cookie ausente');
    expect(header).toContain('HttpOnly');
    expect(response.body).not.toContain('argon2');
    const stored = await database.pool.query('SELECT password_hash, email_verified_at FROM profiles WHERE local_key=$1', [emailB]);
    expect(stored.rows[0].password_hash).toMatch(/^\$argon2id\$v=19\$/);
    expect(stored.rows[0].email_verified_at).toBeNull();
    const tokens = await database.pool.query('SELECT COUNT(*)::int AS n FROM email_verifications ev JOIN profiles p ON p.id=ev.profile_id WHERE p.local_key=$1 AND ev.used_at IS NULL', [emailB]);
    expect(tokens.rows[0].n).toBe(1);
  });
  it('registro duplicado devuelve 409', async () => {
    expect((await register(emailA, passwordA, 'Otra vez')).statusCode).toBe(409);
  });
  it('login rechaza contraseña errónea y acepta la correcta', async () => {
    const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: headers(), payload: { email: emailA, password: 'errónea-123456' } });
    expect(bad.statusCode).toBe(401);
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: headers(), payload: { email: emailA, password: passwordA } });
    expect(response.statusCode).toBe(200);
    const header = response.headers['set-cookie'];
    if (typeof header !== 'string') throw new Error('Cookie ausente');
    cookieA = header.split(';')[0] ?? '';
    csrfA = response.json().csrfToken;
    profileA = response.json().profile.id;
    expect((await app.inject({ url: '/api/v1/me', headers: { cookie: cookieA } })).statusCode).toBe(200);
  });
  it('verificación de email consume el token una sola vez', async () => {
    const raw = 'token-sintetico-verificacion';
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    await database.pool.query(
      "INSERT INTO email_verifications(token_hash, profile_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')",
      [tokenHash, profileA]);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', headers: headers(), payload: { token: raw } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/verify-email', headers: headers(), payload: { token: raw } })).statusCode).toBe(400);
    const stored = await database.pool.query('SELECT email_verified_at FROM profiles WHERE id=$1', [profileA]);
    expect(stored.rows[0].email_verified_at).not.toBeNull();
    expect((await app.inject({ url: '/api/v1/me', headers: { cookie: cookieA } })).json().profile.emailVerified).toBe(true);
  });
  it('recuperación cambia la contraseña del perfil correcto y revoca sesiones', async () => {
    const raw = 'token-sintetico-recuperacion';
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    await database.pool.query(
      "INSERT INTO recovery_tokens(token_hash, profile_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')",
      [tokenHash, profileA]);
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/recovery/confirm', headers: headers(), payload: { token: raw, newPassword: 'nueva-contraseña-A-456' } });
    expect(response.statusCode).toBe(200);
    // La sesión anterior queda revocada y la contraseña vieja ya no vale.
    expect((await app.inject({ url: '/api/v1/me', headers: { cookie: cookieA } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: headers(), payload: { email: emailA, password: passwordA } })).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: headers(), payload: { email: emailA, password: 'nueva-contraseña-A-456' } });
    expect(login.statusCode).toBe(200);
    const header = login.headers['set-cookie'];
    if (typeof header !== 'string') throw new Error('Cookie ausente');
    cookieA = header.split(';')[0] ?? '';
    csrfA = login.json().csrfToken;
    // El otro perfil sigue entrando con su contraseña (el bug del "primer perfil" no vuelve).
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: headers(), payload: { email: emailB, password: passwordB } })).statusCode).toBe(200);
  });
  it('borrado de cuenta verifica la contraseña y anonimiza el perfil', async () => {
    const bad = await app.inject({ method: 'DELETE', url: '/api/v1/account', headers: headers({ cookie: cookieA, 'x-csrf-token': csrfA }), payload: { confirm: true, password: 'errónea-123456' } });
    expect(bad.statusCode).toBe(403);
    const response = await app.inject({ method: 'DELETE', url: '/api/v1/account', headers: headers({ cookie: cookieA, 'x-csrf-token': csrfA }), payload: { confirm: true, password: 'nueva-contraseña-A-456' } });
    expect(response.statusCode).toBe(204);
    // Sin contraseña ni correo: el perfil queda anonimizado, no borrado en
    // cascada, porque las partidas nunca se borran desde la app.
    const stored = await database.pool.query('SELECT local_key, display_name, password_hash FROM profiles WHERE id=$1', [profileA]);
    expect(stored.rows[0].password_hash).toBeNull();
    expect(stored.rows[0].display_name).toBe('Cuenta eliminada');
    expect(stored.rows[0].local_key).toMatch(/^deleted:/);
    const sessionsLeft = await database.pool.query('SELECT COUNT(*)::int AS n FROM sessions WHERE profile_id=$1', [profileA]);
    expect(sessionsLeft.rows[0].n).toBe(0);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: headers(), payload: { email: emailA, password: 'nueva-contraseña-A-456' } })).statusCode).toBe(401);
  });
});
