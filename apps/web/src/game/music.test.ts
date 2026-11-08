import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMusicEngine, type MusicEngine } from './music.js';

/** Parámetro de audio simulado: guarda los valores programados. */
class FakeParam {
  value = 0;
  sets: Array<{ value: number; time: number }> = [];
  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.sets.push({ value, time });
  }
  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.sets.push({ value, time });
  }
  exponentialRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.sets.push({ value, time });
  }
}

class FakeOscillator {
  type: OscillatorType = 'sine';
  frequency = new FakeParam();
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  connect(): void {
    // Sin grafo real: solo registra la conexión por existir.
  }
  start(time: number): void {
    this.startedAt = time;
  }
  stop(time: number): void {
    this.stoppedAt = time;
  }
}

class FakeGain {
  gain = new FakeParam();
  connect(): void {
    // Sin grafo real.
  }
}

/** AudioContext simulado con reloj manual y estado controlable. */
class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = 'running';
  destination = {};
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  resumed = 0;
  closed = false;
  createOscillator(): OscillatorNode {
    const osc = new FakeOscillator();
    this.oscillators.push(osc);
    return osc as unknown as OscillatorNode;
  }
  createGain(): GainNode {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  }
  resume(): Promise<void> {
    this.resumed++;
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

function lastSet(param: FakeParam): number {
  return param.sets[param.sets.length - 1]?.value ?? NaN;
}

describe('motor de música retro (GDD §15)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin factoría de contexto no suena ni rompe nada', () => {
    const engine: MusicEngine = createMusicEngine(() => null);
    expect(engine.supported).toBe(false);
    expect(() => {
      engine.start();
      engine.playEffect('confirm');
      engine.setMusicVolume(80);
      engine.setMuted(true);
      engine.stop();
      engine.dispose();
    }).not.toThrow();
    expect(engine.isPlaying()).toBe(false);
  });

  it('start programa melodía y bajo, y stop detiene el bucle', () => {
    const ctx = new FakeAudioContext();
    const engine = createMusicEngine(() => ctx as unknown as AudioContext);
    engine.start();
    expect(engine.isPlaying()).toBe(true);
    // Primer paso: melodía (La4) + bajo (La2).
    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.oscillators[0]?.frequency.sets[0]?.value).toBeCloseTo(440, 1);
    expect(ctx.oscillators[1]?.frequency.sets[0]?.value).toBeCloseTo(110, 1);
    // Avanza el reloj y deja correr el programador: el bucle sigue.
    ctx.currentTime = 0.2;
    vi.advanceTimersByTime(40);
    expect(ctx.oscillators.length).toBeGreaterThan(2);
    engine.start();
    expect(engine.isPlaying()).toBe(true);
    engine.stop();
    expect(engine.isPlaying()).toBe(false);
    const scheduled = ctx.oscillators.length;
    vi.advanceTimersByTime(500);
    expect(ctx.oscillators.length).toBe(scheduled);
  });

  it('con el contexto suspendido no programa notas hasta el gesto', () => {
    const ctx = new FakeAudioContext();
    ctx.state = 'suspended';
    const engine = createMusicEngine(() => ctx as unknown as AudioContext);
    engine.start();
    expect(engine.isPlaying()).toBe(true);
    vi.advanceTimersByTime(500);
    expect(ctx.oscillators).toHaveLength(0);
    ctx.state = 'running';
    vi.advanceTimersByTime(40);
    expect(ctx.oscillators.length).toBeGreaterThan(0);
    engine.dispose();
  });

  it('volúmenes y mute llegan a los buses con el techo discreto', () => {
    const ctx = new FakeAudioContext();
    const engine = createMusicEngine(() => ctx as unknown as AudioContext);
    engine.start();
    // Creación: master, música, efectos (en ese orden); cada nota programada
    // crea además su propio gain, así que solo se miran los tres primeros.
    expect(ctx.gains.length).toBeGreaterThanOrEqual(3);
    const [master, music, effects] = ctx.gains as [FakeGain, FakeGain, FakeGain];
    expect(lastSet(music.gain)).toBeCloseTo(0.6 * 0.35, 5);
    expect(lastSet(effects.gain)).toBeCloseTo(0.7 * 0.5, 5);
    engine.setMusicVolume(100);
    expect(lastSet(music.gain)).toBeCloseTo(0.35, 5);
    engine.setEffectsVolume(0);
    expect(lastSet(effects.gain)).toBe(0);
    engine.setMuted(true);
    expect(lastSet(master.gain)).toBe(0);
    engine.setMuted(false);
    expect(lastSet(master.gain)).toBe(1);
    engine.setMusicVolume(150);
    expect(lastSet(music.gain)).toBeCloseTo(0.35, 5);
    engine.setMusicVolume(-10);
    expect(lastSet(music.gain)).toBe(0);
  });

  it('los efectos suenan en el bus de efectos y el mute los silencia', () => {
    const ctx = new FakeAudioContext();
    const engine = createMusicEngine(() => ctx as unknown as AudioContext);
    engine.playEffect('confirm');
    expect(ctx.oscillators).toHaveLength(2);
    expect(ctx.oscillators[0]?.frequency.sets[0]?.value).toBeCloseTo(880, 1);
    engine.playEffect('error');
    expect(ctx.oscillators).toHaveLength(3);
    engine.playEffect('travel');
    expect(ctx.oscillators).toHaveLength(7);
    engine.setMuted(true);
    engine.playEffect('click');
    expect(ctx.oscillators).toHaveLength(7);
    engine.setMuted(false);
    engine.setEffectsVolume(0);
    engine.playEffect('click');
    expect(ctx.oscillators).toHaveLength(7);
  });

  it('dispose detiene el bucle y cierra el contexto', () => {
    const ctx = new FakeAudioContext();
    const engine = createMusicEngine(() => ctx as unknown as AudioContext);
    engine.start();
    expect(engine.isPlaying()).toBe(true);
    engine.dispose();
    expect(engine.isPlaying()).toBe(false);
    expect(ctx.closed).toBe(true);
    engine.start();
    expect(engine.isPlaying()).toBe(false);
  });
});
