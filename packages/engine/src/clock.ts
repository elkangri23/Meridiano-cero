// Reloj interno del motor. Minutos relativos, no reloj de pared.

export interface ClockState {
  minute: number;
  deadlineMinutes: number;
}

export function advanceMinute(current: number, delta: number, deadline: number): number {
  const next = current + delta;
  return Math.min(next, deadline);
}

export function hasExpired(minute: number, deadline: number): boolean {
  return minute >= deadline;
}

export function minutesUntilDeadline(minute: number, deadline: number): number {
  return Math.max(0, deadline - minute);
}

// Mezcla reproducible para el juego; nunca usar para secretos o autenticación.
export function seededDelay(seed: number, tripIndex: number): number {
  let value = (seed >>> 0) ^ Math.imul((tripIndex >>> 0) + 1, 0x9e3779b9);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  const roll = ((value ^ (value >>> 16)) >>> 0) % 100;
  return roll < 5 ? 15 + Math.round(roll * 7.5) : 0;
}
