-- 0007_run_delete_difficulty: borrado de partidas y parámetros por partida.
--
-- Contexto (2026-11-05): el usuario no puede borrar sus partidas (no existe
-- DELETE /api/v1/runs/:runId) y no puede elegir dificultad al crearlas.
--
-- Decisiones:
-- * runs.difficulty / runs.deadline_minutes: la dificultad y el plazo elegidos
--   al crear la partida se persisten en la fila, no en la definición del
--   expediente. La definición se vuelve a cargar del catálogo en cada
--   petición (transitions.ts, player-view.ts), así que sin columnas propias
--   el plazo elegido se perdería al recargar. Valores por defecto iguales al
--   caso fijo actual (normal / 2880), así que las partidas existentes no
--   cambian de comportamiento.
-- * El plazo por dificultad es un factor sobre el plazo base del expediente
--   (ver deadlineMinutesForDifficulty en packages/case-schema): fácil 2,
--   normal 1, difícil 0.5. NO es el DIFFICULTY_BUDGET (300/480/600) del
--   catálogo de generación: ese presupuesto es para casos nuevos y aplicado
--   literalmente al astrolabio lo haría incompletable en fácil (sus rutas
--   mínimas verificadas son 455/485 minutos, 545/575 con retrasos máximos).
-- * Borrado con función SECURITY DEFINER delete_run(p_run_id, p_owner_id):
--   el rol meridiano_app NO tiene DELETE sobre operation_records (GRANT
--   mínimo deliberado, migración 0004) ni sobre runs/run_creations
--   (migración 0003). En vez de ampliar sus GRANT, la función —propiedad de
--   meridiano_owner, que es quien aplica las migraciones— borra en orden
--   (operation_records, manual_saves, run_creations, runs) solo las filas del
--   propietario indicado y devuelve si borró la partida. La app solo recibe
--   EXECUTE sobre la función, nunca DELETE directo sobre esas tablas.
--   La función fija search_path=public y revoca EXECUTE a PUBLIC.
-- * Las FK a runs son ON DELETE no action (migraciones 0002/0004): el orden
--   de borrado dentro de la función es obligatorio.

ALTER TABLE "runs" ADD COLUMN "difficulty" text NOT NULL DEFAULT 'normal';
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_difficulty" CHECK ("difficulty" IN ('easy', 'normal', 'hard'));
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "deadline_minutes" integer NOT NULL DEFAULT 2880;
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_deadline_positive" CHECK ("deadline_minutes" > 0);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION delete_run(p_run_id uuid, p_owner_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM operation_records WHERE run_id = p_run_id AND owner_id = p_owner_id;
  DELETE FROM manual_saves WHERE run_id = p_run_id AND owner_id = p_owner_id;
  DELETE FROM run_creations WHERE run_id = p_run_id AND owner_id = p_owner_id;
  DELETE FROM runs WHERE id = p_run_id AND owner_id = p_owner_id;
  RETURN FOUND;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION delete_run(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION delete_run(uuid, uuid) TO meridiano_app;
