-- 0010_official_results: primer resultado oficial de carrera (T5-04, DEC-020).
-- La tabla existe en el esquema Drizzle (apps/api/src/database/schema.ts)
-- desde T3-06, pero ninguna migración la creaba: hasta ahora nada en
-- apps/api/src la escribía ni la leía y `PlayerViewDto.officialResult`
-- era siempre null. Ahora el cierre definitivo persiste aquí su primer
-- resultado oficial por perfil y contenido, de forma idempotente.
--
-- Unicidad por (owner_id, content_hash): el segundo cierre del mismo
-- contenido es práctica y no crea fila ni sustituye la primera. El hash
-- de contenido excluye el id de transporte (ver
-- `contentHashForDefinition` en packages/case-schema/src/server.ts), así
-- que cambiar solo el id no elude la regla. `first_result` guarda el
-- resultado, los objetivos, el motivo, el minuto, las recompensas y los
-- países y lugares descubiertos al cerrar; `rule_version` es la versión
-- de las reglas de carrera aplicadas (1 = valores iniciales de SPEC-008
-- para playtest, no equilibrio definitivo).
--
-- La fila queda fuera del estado restaurable: cargar un guardado no la
-- borra ni la sustituye, y borrar una partida (`delete_run`) tampoco.
-- Sin ON DELETE CASCADE: el borrado de cuenta anonimiza el perfil pero
-- conserva su fila, así que el registro oficial sobrevive sin datos
-- personales (solo hashes, puntuación y recompensas).

CREATE TABLE IF NOT EXISTS "official_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "definition_hash" text NOT NULL,
  "content_hash" text NOT NULL,
  "variant_origin" text,
  "first_result" jsonb NOT NULL,
  "rule_version" integer DEFAULT 1 NOT NULL,
  "operation_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "official_results_owner_content_unique" UNIQUE("owner_id","content_hash"),
  CONSTRAINT "official_results_hash" CHECK ("definition_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "official_results_content" CHECK ("content_hash" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS "official_results_owner_created_idx" ON "official_results" USING btree ("owner_id","created_at");
ALTER TABLE "official_results" ADD CONSTRAINT "official_results_owner_id_profiles_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;

-- Como en las migraciones 0001-0009: la app corre como meridiano_app y
-- necesita el permiso explícito sobre la tabla nueva (sin él, SELECT e
-- INSERT fallan con permiso denegado y la ruta devuelve 503). Solo
-- lectura e inserción: el borrado de filas de prueba se hace como
-- meridiano_owner, nunca desde la app.
GRANT SELECT, INSERT ON "official_results" TO "meridiano_app";
