// Cliente API para el panel de administración (Fase 1)
// Usa fetch con credenciales (cookies) y manejo de errores tipado.

import type {
  AdminDashboardMetrics,
  AdminHealthResponse,
  AdminUserSummary,
  AdminRunSummary,
  AdminAIMetrics,
  AdminAuditLogEntry,
} from '../admin/types.ts';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { code: 'UNKNOWN', message: 'Error' } }));
    throw new Error(error?.error?.message ?? 'Error de la API');
  }

  return response.json() as Promise<T>;
}

export const adminApi = {
  async health(): Promise<AdminHealthResponse> {
    return request('/admin/health');
  },

  async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    // Fase 2: métricas reales desde la API
    return request('/admin/metrics');
  },

  async getUsers(): Promise<{ users: AdminUserSummary[]; total: number }> {
    return request('/admin/users');
  },

  async getUser(id: string): Promise<AdminUserSummary> {
    return request(`/admin/users/${id}`);
  },

  async getRuns(): Promise<{ runs: AdminRunSummary[]; total: number }> {
    return request('/admin/runs');
  },

  async getRun(id: string): Promise<AdminRunSummary> {
    return request(`/admin/runs/${id}`);
  },

  async getAIMetrics(): Promise<AdminAIMetrics[]> {
    return request('/admin/ai/metrics');
  },

  async getAuditLog(): Promise<{ logs: AdminAuditLogEntry[]; total: number }> {
    return request('/admin/audit');
  },
};