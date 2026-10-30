// Fencing, terminales, reservas y equidad (T4-07)
// Recuperación persistente de jobs y pruebas de carreras

export interface FencingToken {
  jobId: string;
  workerId: string;
  token: string;
  issuedAt: string;
  expiresAt: string;
}

export interface Reservation {
  id: string;
  jobId: string;
  resource: string;
  amount: number;
  reservedAt: string;
  expiresAt: string;
  status: 'active' | 'committed' | 'released';
}

export interface TerminalState {
  jobId: string;
  terminalAt: string;
  reason: 'completed' | 'failed' | 'cancelled' | 'timeout';
  finalStatus: string;
}

export class FencingManager {
  private tokens: Map<string, FencingToken> = new Map();
  private reservations: Map<string, Reservation> = new Map();
  private terminals: Map<string, TerminalState> = new Map();

  issueToken(jobId: string, workerId: string, ttlMs: number = 30000): FencingToken {
    const token: FencingToken = {
      jobId,
      workerId,
      token: `fence-${jobId}-${workerId}-${Date.now()}`,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    };
    this.tokens.set(jobId, token);
    return token;
  }

  validateToken(jobId: string, token: string): boolean {
    const stored = this.tokens.get(jobId);
    if (!stored) return false;
    if (stored.token !== token) return false;
    if (new Date(stored.expiresAt).getTime() < Date.now()) return false;
    return true;
  }

  revokeToken(jobId: string): void {
    this.tokens.delete(jobId);
  }

  reserve(jobId: string, resource: string, amount: number, ttlMs: number = 60000): Reservation {
    const reservation: Reservation = {
      id: `res-${jobId}-${resource}-${Date.now()}`,
      jobId,
      resource,
      amount,
      reservedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      status: 'active',
    };
    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  commitReservation(reservationId: string): boolean {
    const res = this.reservations.get(reservationId);
    if (!res || res.status !== 'active') return false;
    if (new Date(res.expiresAt).getTime() < Date.now()) {
      res.status = 'released';
      return false;
    }
    res.status = 'committed';
    return true;
  }

  releaseReservation(reservationId: string): boolean {
    const res = this.reservations.get(reservationId);
    if (!res) return false;
    res.status = 'released';
    return true;
  }

  getActiveReservations(jobId: string): Reservation[] {
    return Array.from(this.reservations.values()).filter(
      r => r.jobId === jobId && r.status === 'active'
    );
  }

  markTerminal(jobId: string, reason: TerminalState['reason'], finalStatus: string): TerminalState {
    const terminal: TerminalState = {
      jobId,
      terminalAt: new Date().toISOString(),
      reason,
      finalStatus,
    };
    this.terminals.set(jobId, terminal);
    this.revokeToken(jobId);
    // Liberar reservas activas
    for (const res of this.reservations.values()) {
      if (res.jobId === jobId && res.status === 'active') {
        res.status = 'released';
      }
    }
    return terminal;
  }

  isTerminal(jobId: string): boolean {
    return this.terminals.has(jobId);
  }

  getTerminal(jobId: string): TerminalState | undefined {
    return this.terminals.get(jobId);
  }

  // Equidad: distribuir jobs por prioridad y tiempo de espera
  selectNextJob(jobs: Array<{ id: string; priority: number; createdAt: string; status: string }>): string | null {
    const pending = jobs.filter(j => j.status === 'pending');
    if (pending.length === 0) return null;

    // Ordenar por prioridad desc, luego por tiempo de espera asc (FIFO para misma prioridad)
    pending.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const first = pending[0];
    return first ? first.id : null;
  }

  // Recuperación de jobs huérfanos (sin worker activo)
  recoverOrphaned(jobs: Array<{ id: string; status: string; leaseUntil?: string }>, now: number = Date.now()): string[] {
    const recovered: string[] = [];
    for (const job of jobs) {
      if (job.status === 'running' && job.leaseUntil) {
        const leaseTime = new Date(job.leaseUntil).getTime();
        if (now > leaseTime) {
          recovered.push(job.id);
        }
      }
    }
    return recovered;
  }
}

export function createFencingManager(): FencingManager {
  return new FencingManager();
}
