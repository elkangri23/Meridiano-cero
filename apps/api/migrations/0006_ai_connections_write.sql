-- Fase C (2026-11-05): la API gestiona conexiones IA personales
-- (crear/actualizar/borrar desde /api/v1/ai/connections).
-- La migración 0004 solo concedía SELECT sobre ai_connections al rol de
-- aplicación porque entonces nadie escribía en esa tabla; ahora hace falta
-- escritura completa. Sin cambios de esquema: la tabla ya existe.
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_connections TO meridiano_app;
