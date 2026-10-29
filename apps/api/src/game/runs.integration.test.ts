import { hashDefinition } from '@meridiano/case-schema/server';
import { createServer, connect, type Socket } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { astrolabioDefinition } from '@meridiano/engine';
import { tokenDigest } from '../auth/store.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { readDatabaseUrl } from '../config.ts';
import { createStoredRun, readStoredRun } from './runs.ts';

// Proxy solo de prueba: corta el transporte al confirmar COMMIT en PostgreSQL,
// antes de que el cliente reciba su acuse. Nunca imprime tráfico/credenciales.
async function commitLossProxy(targetPort: number) {
  const sockets = new Set<Socket>();
  let dropped = false;
  const server = createServer(client => {
    const upstream = connect({ host: '127.0.0.1', port: targetPort });
    sockets.add(client); sockets.add(upstream);
    const dispose = () => { client.destroy(); upstream.destroy(); };
    for (const socket of [client, upstream]) {
      socket.on('error', dispose);
      socket.on('close', () => { sockets.delete(socket); });
    }
    client.pipe(upstream);
    let buffer: Buffer = Buffer.alloc(0);
    upstream.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 65_536) { dispose(); return; }
      while (buffer.length >= 5) {
        const length = buffer.readInt32BE(1) + 1;
        if (length < 5 || length > 65_536) { dispose(); return; }
        if (buffer.length < length) break;
        const frame = buffer.subarray(0, length);
        buffer = buffer.subarray(length);
        if (frame[0] === 67 && frame.subarray(5).toString('utf8').startsWith('COMMIT')) {
          dropped = true; dispose(); return;
        }
        client.write(frame);
      }
    });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing proxy address');
  return {
    port: address.port,
    dropped: () => dropped,
    close: () => new Promise<void>((resolve, reject) => {
      sockets.forEach(socket => socket.destroy());
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}

describe('creación de partidas en PostgreSQL aislado', () => {
  const database = createDatabase(readDatabaseUrl(process.env.DATABASE_URL));
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const profiles = [randomUUID(), randomUUID()];
  const digests = profiles.map(() => tokenDigest(randomBytes(32).toString('base64url')));
  const digest = digests[0];
  if (!digest) throw new Error('Missing session');
  const key = () => randomUUID();

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    for (const [index, profile] of profiles.entries()) {
      await owner.pool.query('INSERT INTO profiles(id, local_key, display_name) VALUES ($1,$2,$3)',
        [profile, 'synthetic-' + profile, 'Detective sintético']);
      await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')",
        [digests[index], profile, randomBytes(32).toString('base64url')]);
    }
  });
  afterAll(async () => {
    for (const profile of profiles) {
      await owner.pool.query('DELETE FROM run_creations WHERE owner_id=$1', [profile]);
      await owner.pool.query('DELETE FROM runs WHERE owner_id=$1', [profile]);
      await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [profile]);
      await owner.pool.query('DELETE FROM profiles WHERE id=$1', [profile]);
    }
    await database.pool.end();
    await owner.pool.end();
  });

  it('crea y reanuda el agregado privado desde otra conexión sin compartir memoria', async () => {
    const created = await createStoredRun(database, digest, astrolabioDefinition, key());
    expect(created.replayed).toBe(false);
    expect(created.run.revision).toBe(1);
    expect(created.run.engineState).toMatchObject({ id: created.run.id, ownerId: profiles[0], minute: 0 });
    const other = createDatabase(readDatabaseUrl(process.env.DATABASE_URL));
    try {
      expect(await readStoredRun(other, digest, created.run.id)).toEqual(created.run);
    } finally { await other.pool.end(); }
  });

  it('dos conexiones con la misma intención solo crean una partida', async () => {
    const sameKey = key();
    const results = await Promise.all([
      createStoredRun(database, digest, astrolabioDefinition, sameKey),
      createStoredRun(database, digest, astrolabioDefinition, sameKey),
    ]);
    expect(new Set(results.map(result => result.run.id)).size).toBe(1);
    expect(results.map(result => result.replayed).sort()).toEqual([false, true]);
    const count = await owner.pool.query('SELECT count(*)::int AS n FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [profiles[0], sameKey]);
    expect(count.rows[0].n).toBe(1);
  });

  it('reintento precede a disponibilidad y otra intención con igual clave entra en conflicto', async () => {
    const sameKey = key();
    const created = await createStoredRun(database, digest, astrolabioDefinition, sameKey);
    const unavailable = structuredClone(astrolabioDefinition);
    unavailable.validationReport.status = 'rejected';
    expect((await createStoredRun(database, digest, unavailable, sameKey)).run.id).toBe(created.run.id);
    await expect(createStoredRun(database, digest, { ...astrolabioDefinition, id: 'another-case' }, sameKey))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(createStoredRun(database, digest, unavailable, key())).rejects.toMatchObject({ code: 'CASE_NOT_READY' });
  });

  it('no crea una partida ni intención desde referencias rotas aunque el reporte diga validated', async () => {
    const candidate = structuredClone(astrolabioDefinition);
    candidate.locations = candidate.locations.map(location => ({ ...location, cityId: 'synthetic-missing-city' }));
    const originalKey = key();
    const original = await createStoredRun(database, digest, astrolabioDefinition, originalKey);
    expect((await createStoredRun(database, digest, candidate, originalKey)).run.id).toBe(original.run.id);
    const before = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]]);
    const intent = key();
    await expect(createStoredRun(database, digest, candidate, intent)).rejects.toMatchObject({ code: 'CASE_NOT_READY' });
    const after = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]]);
    expect(after.rows).toEqual(before.rows);
    const ledger = await owner.pool.query('SELECT count(*)::int AS n FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [profiles[0], intent]);
    expect(ledger.rows[0].n).toBe(0);
  });

  it('mapa desconectado no crea filas y conserva replay de intención previa autorizada', async () => {
    const candidate = structuredClone(astrolabioDefinition);
    candidate.travelDurations = candidate.travelDurations.filter(route => route.fromCityId !== 'madrid');
    const originalKey = key();
    const original = await createStoredRun(database, digest, astrolabioDefinition, originalKey);
    expect((await createStoredRun(database, digest, candidate, originalKey)).run.id).toBe(original.run.id);
    const before = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]]);
    const intent = key();
    await expect(createStoredRun(database, digest, candidate, intent)).rejects.toMatchObject({ code: 'CASE_NOT_READY' });
    expect((await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]])).rows).toEqual(before.rows);
    expect((await owner.pool.query('SELECT count(*)::int AS n FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [profiles[0], intent])).rows[0].n).toBe(0);
  });

  it('referencias de solución/conocimiento inválidas rechazan nuevas intenciones sin perder replay previo', async () => {
    const originalKey = key();
    const original = await createStoredRun(database, digest, astrolabioDefinition, originalKey);
    const candidates = [
      { ...structuredClone(astrolabioDefinition), solution: 'synthetic-missing-suspect' },
      { ...structuredClone(astrolabioDefinition), npcs: astrolabioDefinition.npcs.map(npc => ({ ...npc, knowledge: ['synthetic-missing-fact'] })) },
    ];
    const before = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]]);
    for (const candidate of candidates) {
      expect((await createStoredRun(database, digest, candidate, originalKey)).run.id).toBe(original.run.id);
      const intent = key();
      await expect(createStoredRun(database, digest, candidate, intent)).rejects.toMatchObject({ code: 'CASE_NOT_READY' });
      expect((await owner.pool.query('SELECT count(*)::int AS n FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [profiles[0], intent])).rows[0].n).toBe(0);
    }
    expect((await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]])).rows).toEqual(before.rows);
  });

  it('contenido no ejecutable no crea filas y conserva replay previo de intención autorizada', async () => {
    const originalKey = key();
    const original = await createStoredRun(database, digest, astrolabioDefinition, originalKey);
    const candidates = [
      { ...structuredClone(astrolabioDefinition), rules: ['synthetic-unknown-operator'] },
      { ...structuredClone(astrolabioDefinition), scheduledResults: [{ id: 'synthetic-scheduled', type: 'communicate', dueMinute: 30, payload: {} }] },
    ];
    const before = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]]);
    for (const candidate of candidates) {
      expect((await createStoredRun(database, digest, candidate, originalKey)).run.id).toBe(original.run.id);
      const intent = key();
      await expect(createStoredRun(database, digest, candidate, intent)).rejects.toMatchObject({ code: 'CASE_NOT_READY' });
      expect((await owner.pool.query('SELECT count(*)::int AS n FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [profiles[0], intent])).rows[0].n).toBe(0);
    }
    expect((await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]])).rows).toEqual(before.rows);
  });

  it('campos no soportados no crean filas y no impiden recuperar una intención propia anterior', async () => {
    const originalKey = key();
    const original = await createStoredRun(database, digest, astrolabioDefinition, originalKey);
    const candidates = [
      { ...structuredClone(astrolabioDefinition), disclosureRules: [{ factId: 'EV-09' }] },
      { ...structuredClone(astrolabioDefinition), npcs: astrolabioDefinition.npcs.map(npc => ({ ...npc, cooperationRules: { pressure: 10 } })) },
      { ...structuredClone(astrolabioDefinition), validationReport: { ...astrolabioDefinition.validationReport, approvedPolicies: true } },
    ];
    const before = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]]);
    for (const candidate of candidates) {
      expect((await createStoredRun(database, digest, candidate, originalKey)).run.id).toBe(original.run.id);
      const intent = key();
      await expect(createStoredRun(database, digest, candidate, intent)).rejects.toMatchObject({ code: 'CASE_NOT_READY' });
      expect((await owner.pool.query('SELECT count(*)::int AS n FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [profiles[0], intent])).rows[0].n).toBe(0);
    }
    expect((await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]])).rows).toEqual(before.rows);
  });

  it('valida y persiste una copia estable aunque el llamador cambie su definición mientras espera SQL', async () => {
    const candidate = structuredClone(astrolabioDefinition);
    const expectedHash = hashDefinition(candidate);
    const pending = createStoredRun(database, digest, candidate, key());
    candidate.locations = [];
    candidate.solution = 'synthetic-changed-after-call';
    const result = await pending;
    expect(result.run.definitionHash).toBe(expectedHash);
    expect((await readStoredRun(database, digest, result.run.id)).definitionHash).toBe(expectedHash);
  });

  it('extensión no serializable se rechaza antes del hash sin bloquear replay autorizado', async () => {
    const originalKey = key();
    const original = await createStoredRun(database, digest, astrolabioDefinition, originalKey);
    // Extensión sintética privada no serializable, no una importación JSON.
    // El formato cerrado ahora rechaza esa extensión antes de preparar el hash.
    const candidate = { ...structuredClone(astrolabioDefinition), syntheticUnhashable: 1n };
    expect((await createStoredRun(database, digest, candidate, originalKey)).run.id).toBe(original.run.id);
    const before = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]]);
    const intent = key();
    await expect(createStoredRun(database, digest, candidate, intent)).rejects.toMatchObject({ code: 'CASE_NOT_READY' });
    const after = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]]);
    expect(after.rows).toEqual(before.rows);
    const ledger = await owner.pool.query('SELECT count(*)::int AS n FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [profiles[0], intent]);
    expect(ledger.rows[0].n).toBe(0);
  });

  it('partida ajena, inexistente e ID mal formado no revelan diferencias', async () => {
    const created = await createStoredRun(database, digest, astrolabioDefinition, key());
    const otherDigest = digests[1];
    if (!otherDigest) throw new Error('Missing session');
    for (const id of [created.run.id, randomUUID(), 'invalid']) {
      await expect(readStoredRun(database, otherDigest, id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  it('rollback conserva cero partidas huérfanas si falla el registro de idempotencia', async () => {
    const failingKey = 'synthetic-forced-failure';
    const before = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]]);
    await owner.pool.query(`CREATE FUNCTION synthetic_fail_creation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.idempotency_key = 'synthetic-forced-failure' THEN RAISE EXCEPTION 'synthetic'; END IF; RETURN NEW; END $$`);
    try {
      await owner.pool.query('CREATE TRIGGER synthetic_fail_creation BEFORE INSERT ON run_creations FOR EACH ROW EXECUTE FUNCTION synthetic_fail_creation()');
      await expect(createStoredRun(database, digest, astrolabioDefinition, failingKey)).rejects.toThrow();
      const after = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [profiles[0]]);
      expect(after.rows[0].n).toBe(before.rows[0].n);
    } finally {
      await owner.pool.query('DROP TRIGGER IF EXISTS synthetic_fail_creation ON run_creations');
      await owner.pool.query('DROP FUNCTION synthetic_fail_creation()');
    }
  });

  it('la misma clave en usuarios distintos no comparte la partida', async () => {
    const sharedKey = key();
    const otherDigest = digests[1];
    if (!otherDigest) throw new Error('Missing session');
    const first = await createStoredRun(database, digest, astrolabioDefinition, sharedKey);
    const second = await createStoredRun(database, otherDigest, astrolabioDefinition, sharedKey);
    expect(first.run.id).not.toBe(second.run.id);
    expect(first.run.ownerId).not.toBe(second.run.ownerId);
  });

  it('no concede modificación ni borrado del ledger al rol de aplicación', async () => {
    const grants = await database.pool.query(`SELECT
      has_table_privilege(current_user, 'runs', 'SELECT,INSERT') AS can_start,
      has_table_privilege(current_user, 'run_creations', 'UPDATE') AS can_update,
      has_table_privilege(current_user, 'run_creations', 'DELETE') AS can_delete`);
    expect(grants.rows[0]).toEqual({ can_start: true, can_update: false, can_delete: false });
  });

  it('BOR-012 parcial: corte real del socket tras COMMIT recupera la misma creación', async () => {
    const target = new URL(readDatabaseUrl(process.env.DATABASE_URL));
    const proxy = await commitLossProxy(Number(target.port));
    target.port = String(proxy.port);
    const interrupted = createDatabase(target.toString());
    const sameKey = key();
    try {
      await expect(createStoredRun(interrupted, digest, astrolabioDefinition, sameKey)).rejects.toThrow();
      expect(proxy.dropped()).toBe(true);
      const recovered = await createStoredRun(database, digest, astrolabioDefinition, sameKey);
      expect(recovered.replayed).toBe(true);
      const rows = await owner.pool.query('SELECT count(*)::int AS n FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [profiles[0], sameKey]);
      expect(rows.rows[0].n).toBe(1);
      expect((await readStoredRun(database, digest, recovered.run.id)).id).toBe(recovered.run.id);
    } finally { await interrupted.pool.end(); await proxy.close(); }
  });

  it('BOR-078 parcial: un esquema futuro bloquea escritura aunque la sesión siga vigente', async () => {
    await owner.pool.query("INSERT INTO base_migrations(name,hash) VALUES ('9998_synthetic_future.sql',$1)", ['0'.repeat(64)]);
    const intent = key();
    try {
      await expect(createStoredRun(database, digest, astrolabioDefinition, intent)).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
      const rows = await owner.pool.query('SELECT count(*)::int AS n FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [profiles[0], intent]);
      expect(rows.rows[0].n).toBe(0);
    } finally { await owner.pool.query("DELETE FROM base_migrations WHERE name='9998_synthetic_future.sql'"); }
  });

  it('revocar sesión impide leer y reproducir incluso una creación confirmada', async () => {
    const sameKey = key();
    const created = await createStoredRun(database, digest, astrolabioDefinition, sameKey);
    await owner.pool.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1', [digest]);
    await expect(readStoredRun(database, digest, created.run.id)).rejects.toMatchObject({ code: 'SESSION_REQUIRED' });
    await expect(createStoredRun(database, digest, astrolabioDefinition, sameKey)).rejects.toMatchObject({ code: 'SESSION_REQUIRED' });
    await expect(createStoredRun(database, '', astrolabioDefinition, key())).rejects.toMatchObject({ code: 'SESSION_REQUIRED' });
  });
});
