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
});