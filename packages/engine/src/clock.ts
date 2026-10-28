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

// Seeded PRNG para retrasos de viaje
export function seededDelay(seed: number, tripIndex: number): number {
  // Determinista: mismo seed + tripIndex = mismo retraso
  const hash = (seed * 31 + tripIndex * 17) % 100;
  // 5% de probabilidad de retraso (hash < 5)
  if (hash < 5) {
    // Retraso de 15-45 minutos
    return 15 + (hash * 6);
  }
  return 0;
}