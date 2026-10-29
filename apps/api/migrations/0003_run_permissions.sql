-- Mantener el historial aplicado: reducir permisos en una migración posterior.
-- Esta entrega solo crea/consulta partidas. Las transiciones tendrán su migración.
REVOKE UPDATE, DELETE ON runs, run_creations FROM meridiano_app;
GRANT SELECT, INSERT ON runs, run_creations TO meridiano_app;
