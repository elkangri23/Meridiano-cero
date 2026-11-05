import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi, AuthError } from './client';
import type { AuthSession } from './client';
import type { SessionDto } from '@meridiano/contracts';

const id = '11111111-1111-4111-8111-111111111111';
const session: AuthSession = { profile: { id, displayName: 'Detective sintético', emailVerified: false }, csrfToken: 's'.repeat(43) };
const gameSession: SessionDto = { profile: { id, displayName: 'Detective sintético', role: 'player', emailVerified: false }, csrfToken: 's'.repeat(43) };
const signal = () => new AbortController().signal;
function respond(body: unknown, status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher); return fetcher;
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('Autenticación web: registro e inicio de sesión', () => {
  it('registro válido usa mismo origen y devuelve sesión sin verificar', async () => {
    const fetcher = respond(session);
    expect(await authApi.register('detective@sintetico.invalid', 'Detective sintético', 'contraseña-sintética-123', signal())).toEqual(session);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/auth/register');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      body: JSON.stringify({ email: 'detective@sintetico.invalid', displayName: 'Detective sintético', password: 'contraseña-sintética-123' }) });
  });
  it('registro duplicado es 409 con error propio y no inventa sesión', async () => {
    respond({ error: { code: 'EMAIL_ALREADY_REGISTERED' } }, 409);
    await expect(authApi.register('detective@sintetico.invalid', 'Detective sintético', 'contraseña-sintética-123', signal()))
      .rejects.toEqual(new AuthError('email_taken'));
  });
  it('login con contraseña errónea es 401 y con la correcta devuelve sesión verificada', async () => {
    respond({ error: { code: 'INVALID_CREDENTIALS' } }, 401);
    await expect(authApi.login('detective@sintetico.invalid', 'errónea-123456', signal())).rejects.toEqual(new AuthError('bad_credentials'));
    const verified = { ...session, profile: { ...session.profile, emailVerified: true } };
    const fetcher = respond(verified);
    expect(await authApi.login('detective@sintetico.invalid', 'contraseña-sintética-123', signal())).toEqual(verified);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ email: 'detective@sintetico.invalid', password: 'contraseña-sintética-123' }) });
  });
  it('rechaza respuestas de sesión fuera de contrato antes de usarlas', async () => {
    respond({ ...session, profile: { ...session.profile, emailVerified: 'sí' } });
    await expect(authApi.register('detective@sintetico.invalid', 'Detective sintético', 'contraseña-sintética-123', signal()))
      .rejects.toEqual(new AuthError('invalid'));
    respond({ ...session, csrfToken: 'corto' });
    await expect(authApi.login('detective@sintetico.invalid', 'contraseña-sintética-123', signal())).rejects.toEqual(new AuthError('invalid'));
  });
  it('valida entradas en local sin llamar a la API', async () => {
    const fetcher = respond(session);
    await expect(authApi.register('sin-arroba', 'Detective', 'contraseña-sintética-123', signal())).rejects.toEqual(new AuthError('invalid'));
    await expect(authApi.register('detective@sintetico.invalid', 'Detective', 'corta', signal())).rejects.toEqual(new AuthError('invalid'));
    await expect(authApi.login('detective@sintetico.invalid', '', signal())).rejects.toEqual(new AuthError('invalid'));
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('límite de intentos es 429 con error propio', async () => {
    respond({ error: { code: 'RATE_LIMITED' } }, 429);
    await expect(authApi.login('detective@sintetico.invalid', 'contraseña-sintética-123', signal())).rejects.toEqual(new AuthError('rate_limited'));
  });
});

describe('Autenticación web: verificación y recuperación', () => {
  it('verificación válida exige verified true y token fuera de la URL', async () => {
    const fetcher = respond({ verified: true });
    await authApi.verifyEmail('token-sintético', signal());
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/auth/verify-email');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ token: 'token-sintético' }) });
    respond({ verified: false });
    await expect(authApi.verifyEmail('token-sintético', signal())).rejects.toEqual(new AuthError('invalid'));
  });
  it('token de verificación inválido es 400 con error propio', async () => {
    respond({ error: { code: 'INVALID_VERIFICATION_TOKEN' } }, 400);
    await expect(authApi.verifyEmail('token-malo', signal())).rejects.toEqual(new AuthError('bad_token'));
  });
  it('reenvío de verificación usa sesión y CSRF por cabecera', async () => {
    const fetcher = respond({ message: 'Si la cuenta necesita verificación, se ha enviado el correo.' });
    await authApi.resendVerification(session, signal());
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/auth/verify-email/resend');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', headers: { 'x-csrf-token': session.csrfToken }, body: '{}' });
    respond({ error: { code: 'EMAIL_NOT_CONFIGURED' } }, 503);
    await expect(authApi.resendVerification(session, signal())).rejects.toEqual(new AuthError('not_configured'));
  });
  it('recuperación pide correo y confirma con token y contraseña nueva', async () => {
    const fetcher = respond({ message: 'Si la cuenta existe, se ha enviado un enlace de recuperación.' });
    await authApi.requestRecovery('detective@sintetico.invalid', signal());
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/auth/recovery/request');
    const confirmer = respond({ message: 'Contraseña actualizada. Inicie sesión con la nueva contraseña.' });
    await authApi.confirmRecovery('token-sintético', 'contraseña-nueva-123', signal());
    expect(confirmer.mock.calls[0]?.[0]).toBe('/api/v1/auth/recovery/confirm');
    expect(confirmer.mock.calls[0]?.[1]).toMatchObject({ body: JSON.stringify({ token: 'token-sintético', newPassword: 'contraseña-nueva-123' }) });
    respond({ error: { code: 'INVALID_RECOVERY_TOKEN' } }, 400);
    await expect(authApi.confirmRecovery('token-malo', 'contraseña-nueva-123', signal())).rejects.toEqual(new AuthError('bad_token'));
  });
  it('me devuelve la sesión de juego o null con 401', async () => {
    const fetcher = respond(gameSession);
    expect(await authApi.me(signal())).toEqual(gameSession);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/me');
    respond({ error: 'synthetic' }, 401);
    expect(await authApi.me(signal())).toBeNull();
  });
});
