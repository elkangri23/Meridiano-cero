// Tipos compartidos para el panel de administración (Fase 1)

export type UserRole = 'player' | 'admin' | 'superadmin';

export interface AdminProfile {
  id: string;
  displayName: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
}

export interface AdminUserSummary {
  id: string;
  displayName: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
  runsTotal: number;
  runsActive: number;
  lastActiveAt: string | null;
}

export interface AdminRunSummary {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  definitionId: string;
  status: 'active' | 'closed';
  difficulty: 'easy' | 'normal' | 'hard';
  deadlineMinutes: number;
  revision: number;
  engineVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAIMetrics {
  providerId: string;
  model: string;
  totalTokens: number;
  avgLatencyMs: number;
  requestCount: number;
  errorCount: number;
}

export interface AdminDashboardMetrics {
  usersTotal: number;
  usersActive24h: number;
  runsTotal: number;
  runsActive: number;
  aiTokensUsed24h: number;
  aiErrorRate24h: number;
}

export interface AdminAuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminHealthResponse {
  status: 'ok';
  timestamp: string;
  version: string;
}
