-- 0012_exploration_mode: modo de exploración por partida.
--
-- Contexto (2026-11-08): el modo de exploración (guiado/libre, GDD §5)
-- se elegía en la definición del expediente, no por partida: todos los
-- expedientes traen 'guided' y no había forma de jugar en libre.
--
-- Decisiones:
-- * runs.exploration_mode: el modo elegido al crear la partida se persiste
--   en la fila, no en la definición del expediente. La definición se vuelve
--   a cargar del catálogo en cada petición (transitions.ts, player-view.ts),
--   así que sin columna propia el modo elegido se perdería al recargar (el
--   mismo motivo que la dificultad y el plazo en la migración 0007).
--   Valor por defecto 'guided': las partidas existentes no cambian de
--   comportamiento.
-- * Sin cambios en el estado del motor (engine_state): el modo solo afecta
--   a la vista (qué ciudades se enseñan) y a las ofertas de viaje, no a las
--   reglas del motor; el viaje libre lo valida la ruta, no el modo.

ALTER TABLE "runs" ADD COLUMN "exploration_mode" text NOT NULL DEFAULT 'guided';
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_exploration_mode" CHECK ("exploration_mode" IN ('guided', 'free'));
