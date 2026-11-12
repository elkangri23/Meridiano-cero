-- Tabla de auditoría para acciones de administración (Fase 1 del panel admin).
-- Ya era idempotente en su versión original; se traslada tal cual al
-- directorio de migraciones que lee el runner (apps/api/migrations/).
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para consultas de auditoría
CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON admin_audit_log(action, created_at DESC);
