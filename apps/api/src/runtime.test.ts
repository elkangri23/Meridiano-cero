import { describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import Fastify from 'fastify';
import { registerRuntime } from './runtime.ts';
import { createApp } from './app.ts';
import { createTelemetry } from './telemetry.ts';

function barrier() {
  let release: () => void = () => {};
  const waiting = new Promise<void>(resolve => { release = resolve; });
  return { waiting, release };
}

describe('admisión y telemetría bajo fallos', () => {
  it('32 peticiones ocupadas rechazan la siguiente sin cola y health sigue disponible', async () => {
    const app = createApp();
    const gate = barrier();
    const entered = barrier();
    let count = 0;
    app.get('/held', async () => {
      if (++count === 32) entered.release();
      await gate.waiting;
      return { ok: true };
    });
    await app.ready();
    const pending = Array.from({ length: 32 }, () => app.inject('/held').then(response => response.statusCode));
    try {
      await entered.waiting;
      const rejected = await app.inject('/held');
      expect(rejected.statusCode).toBe(503);
      expect(rejected.headers['retry-after']).toBe('1');
      expect(count).toBe(32);
      expect((await app.inject('/api/v1/health')).statusCode).toBe(200);
    } finally { gate.release(); await Promise.all(pending); await app.close(); }
  });

  it('draining rechaza antes de iniciar trabajo', async () => {
    const state = { draining: true };
    // Configuración real se prueba en PostgreSQL; aquí basta el hook de admisión.
    const app = Fastify();
    registerRuntime(app, state);
    let executed = false;
    app.post('/mutate', async () => { executed = true; return {}; });
    try {
      expect((await app.inject({ method: 'POST', url: '/mutate' })).statusCode).toBe(503);
      expect(executed).toBe(false);
    } finally { await app.close(); }
  });

  it('errores del sink y eventos enormes no exponen centinelas ni labels arbitrarios', () => {
    const lines: string[] = [];
    const sink = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done(); } });
    const telemetry = createTelemetry(sink);
    const event = { requestId: '00000000-0000-0000-0000-000000000000', statusCode: 500, durationMs: 8,
      body: 'PRIVATE_BODY', cookie: 'PRIVATE_COOKIE', solution: 'PRIVATE_SOLUTION', url: '/PRIVATE_PATH', error: new Error('PRIVATE_EXCEPTION') };
    telemetry.completed(event);
    expect(lines).toHaveLength(1);
    expect(lines.join('')).not.toContain('PRIVATE_');
    expect(JSON.parse(lines[0] ?? '{}').eventName).toBe('request.completed');
    sink.emit('error', new Error('PRIVATE_COLLECTOR'));
    for (let index = 0; index < 1000; index++) telemetry.completed({ ...event, requestId: String(index) });
    expect(lines).toHaveLength(1);
    expect(telemetry.snapshot()).toMatchObject({ exporterFailures: 1, dropped: 1000 });
    expect(telemetry.snapshot().statusClasses).toHaveLength(5);
    expect(telemetry.snapshot().durations).toHaveLength(7);
  });

  it('health y readiness no inflan el contador de peticiones de producto', () => {
    const sink = new Writable({ write(_chunk, _encoding, done) { done(); } });
    const telemetry = createTelemetry(sink);
    const event = { requestId: '00000000-0000-0000-0000-000000000000', statusCode: 200, durationMs: 1 };
    telemetry.completed({ ...event, scope: 'health' });
    telemetry.completed({ ...event, scope: 'readiness' });
    expect(telemetry.snapshot().statusClasses).toEqual([0, 0, 0, 0, 0]);
    expect(telemetry.snapshot().probes.health.statusClasses).toEqual([0, 1, 0, 0, 0]);
    expect(telemetry.snapshot().probes.readiness.statusClasses).toEqual([0, 1, 0, 0, 0]);
  });

  it('backpressure descarta sin crecer la cola y drain permite continuar', async () => {
    let finish: () => void = () => {};
    const sink = new Writable({ highWaterMark: 1, write(_chunk, _encoding, done) { finish = done; } });
    const telemetry = createTelemetry(sink);
    const event = { requestId: '00000000-0000-0000-0000-000000000000', statusCode: 200, durationMs: 10 };
    telemetry.completed(event);
    const size = sink.writableLength;
    for (let index = 0; index < 1000; index++) telemetry.completed(event);
    expect(sink.writableLength).toBe(size);
    expect(telemetry.snapshot().dropped).toBe(1000);
    const drained = new Promise<void>(resolve => sink.once('drain', resolve));
    finish(); await drained;
    telemetry.completed(event);
    expect(telemetry.snapshot().dropped).toBe(1000);
    finish();
  });
});
