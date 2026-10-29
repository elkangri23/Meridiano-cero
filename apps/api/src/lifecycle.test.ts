import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShutdown } from './lifecycle.ts';

afterEach(() => { vi.useRealTimers(); });
describe('parada idempotente y presupuesto', () => {
  it('señales repetidas comparten cierre único y estado draining', async () => {
    let finish: () => void = () => {};
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const close = vi.fn(() => gate);
    const state = { draining: false };
    const force = vi.fn();
    const stop = createShutdown({ state, close, force, failed: vi.fn() });
    const first = stop();
    expect(stop()).toBe(first);
    expect(state.draining).toBe(true);
    await Promise.resolve();
    expect(close).toHaveBeenCalledTimes(1);
    finish(); await first;
    expect(force).not.toHaveBeenCalled();
  });
  it('deadline fuerza una sola salida aunque luego falle el cierre', async () => {
    vi.useFakeTimers();
    let fail: (error: Error) => void = () => {};
    const gate = new Promise<void>((_resolve, reject) => { fail = reject; });
    const force = vi.fn();
    const failed = vi.fn();
    const stop = createShutdown({ state: { draining: false }, close: () => gate, force, failed, timeoutMs: 10 });
    const stopped = stop();
    await vi.advanceTimersByTimeAsync(10);
    expect(force).toHaveBeenCalledTimes(1);
    fail(new Error('SYNTHETIC_CLOSE_ERROR'));
    await stopped;
    expect(failed).toHaveBeenCalledTimes(1);
    expect(force).toHaveBeenCalledTimes(1);
  });
});
