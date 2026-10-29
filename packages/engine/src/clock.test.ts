import { describe, it, expect } from 'vitest';
import { advanceMinute, hasExpired, minutesUntilDeadline, seededDelay } from './clock.js';

describe('clock', () => {
  it('advanceMinute caps at deadline', () => {
    expect(advanceMinute(100, 50, 120)).toBe(120);
    expect(advanceMinute(100, 10, 120)).toBe(110);
  });

  it('hasExpired', () => {
    expect(hasExpired(120, 120)).toBe(true);
    expect(hasExpired(119, 120)).toBe(false);
  });

  it('minutesUntilDeadline', () => {
    expect(minutesUntilDeadline(100, 120)).toBe(20);
    expect(minutesUntilDeadline(120, 120)).toBe(0);
    expect(minutesUntilDeadline(130, 120)).toBe(0);
  });

  it('seededDelay is deterministic', () => {
    const d1 = seededDelay(42, 0);
    const d2 = seededDelay(42, 0);
    expect(d1).toBe(d2);
  });

  it('seededDelay returns 0 or 15-45', () => {
    for (let i = 0; i < 20; i++) {
      const d = seededDelay(42, i);
      expect(d === 0 || (d >= 15 && d <= 45)).toBe(true);
    }
  });
  it('la variante máxima es reproducible y aplica 45 minutos en ambos tramos', () => {
    expect(seededDelay(14194, 0)).toBe(45);
    expect(seededDelay(14194, 1)).toBe(45);
  });
  it('muestra determinista amplia conserva rango entero y frecuencia nominal sin exigirla por partida', () => {
    const outcomes = new Set<number>(); let delayed = 0;
    for (let seed = 0; seed < 65536; seed++) {
      const minutes = seededDelay(seed, 0);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 45) throw new Error('Retraso fuera de rango');
      if (minutes > 0 && minutes < 15) throw new Error('Retraso positivo por debajo del mínimo');
      outcomes.add(minutes);
      if (minutes > 0) delayed++;
    }
    expect(Math.min(...[...outcomes].filter(value => value > 0))).toBe(15);
    expect(Math.max(...outcomes)).toBe(45);
    expect(delayed / 65536).toBeGreaterThan(0.04);
    expect(delayed / 65536).toBeLessThan(0.06);
  });

});
