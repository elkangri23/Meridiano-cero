-- Permisos mínimos del rol de la aplicación sobre la tabla de auditoría.
-- La migración 0014 creó admin_audit_log sin concederle nada y los
-- endpoints de auditoría (SELECT) y el registro de acciones (INSERT)
-- devolvían 500 por falta de permisos. GRANT es idempotente.
GRANT SELECT, INSERT ON admin_audit_log TO meridiano_app;
