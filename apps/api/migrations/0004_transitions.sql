-- 0004_transitions: tablas que el código ya usa pero que ninguna migración creaba
-- (manual_saves, operation_records, ai_usage, ai_quotas, ai_global_cutoff,
-- ai_connections) y permisos mínimos para persistir transiciones de partida.
--
-- Contexto Fase A (2026-11-05): hasta ahora `pnpm db:migrate` solo creaba
-- profiles, sessions, run_creations y runs; las rutas de guardados, el registro
-- de operaciones y la cuota de IA fallaban en ejecución con "relation does not
-- exist". Las definiciones DDL reproducen apps/api/src/database/schema.ts
-- (y las definiciones duplicadas de apps/api/src/ai/ai-quota.ts y
-- apps/api/src/ai/ai-connections.ts) para que un futuro `drizzle-kit generate`
-- no proponga crearlas de nuevo.
--
-- Decisiones:
-- * NO se añade columna `status` a runs: el estado autoritativo vive en
--   engine_state->>'status' (así lo lee apps/api/src/game/run-list.ts y lo
--   escribe el motor). La columna `status` que declara schema.ts en drizzle
--   no se usa por ninguna consulta y añadirla crearía una segunda fuente de
--   verdad. Queda como deuda documentada en docs/plan/ESTADO.md.
-- * runs: UPDATE solo por columnas (engine_state, revision, branch_id,
--   updated_at). Sin DELETE: el historial de partidas no se borra desde la app.
-- * official_results, detective_profiles, instances y case_runs NO se crean
--   aquí: no los usa el runtime de la Fase A (carrera y legado).
-- * Como las migraciones 0001-0003, los GRANT son manuales y no están en el
--   modelo drizzle: un `db:generate` futuro no debe reescribir este archivo.

-- Conexiones IA personales (T7-02). Sin ella no puede existir la FK de ai_usage.
CREATE TABLE "ai_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "adapter_id" text NOT NULL,
  "base_url" text NOT NULL,
  "model" text NOT NULL,
  "credential_ref" text NOT NULL,
  "encrypted_credential" text NOT NULL,
  "roles" text[] DEFAULT '{}' NOT NULL,
  "limits" jsonb NOT NULL,
  "capabilities" text[] DEFAULT '{}' NOT NULL,
  "is_default" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone,
  "last_error" text,
  "error_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "ai_connections_owner_name_unique" UNIQUE("owner_id","name"),
  CONSTRAINT "ai_connections_status" CHECK ("status" IN ('active', 'disabled', 'error'))
);
--> statement-breakpoint
CREATE INDEX "ai_connections_owner_idx" ON "ai_connections" USING btree ("owner_id");
--> statement-breakpoint
ALTER TABLE "ai_connections" ADD CONSTRAINT "ai_connections_owner_id_profiles_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Uso y cuotas de IA (T7-03). Las rutas /ai/* consultan cuotas y registran uso.
CREATE TABLE "ai_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid,
  "connection_id" uuid,
  "function" text NOT NULL,
  "provider_id" text NOT NULL,
  "model" text NOT NULL,
  "prompt_tokens" integer DEFAULT 0 NOT NULL,
  "completion_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "latency_ms" integer NOT NULL,
  "status" text NOT NULL,
  "error_code" text,
  "request_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_usage_owner_created_idx" ON "ai_usage" USING btree ("owner_id","created_at");
--> statement-breakpoint
CREATE INDEX "ai_usage_connection_created_idx" ON "ai_usage" USING btree ("connection_id","created_at");
--> statement-breakpoint
CREATE INDEX "ai_usage_provider_created_idx" ON "ai_usage" USING btree ("provider_id","created_at");
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_owner_id_profiles_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_connection_id_ai_connections_id_fk"
  FOREIGN KEY ("connection_id") REFERENCES "public"."ai_connections"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

CREATE TABLE "ai_quotas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope" text NOT NULL,
  "scope_value" text,
  "limit_type" text NOT NULL,
  "limit_value" integer NOT NULL,
  "window_seconds" integer NOT NULL,
  "action" text DEFAULT 'deny' NOT NULL,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_quotas_unique" UNIQUE("scope","scope_value","limit_type"),
  CONSTRAINT "ai_quotas_limit" CHECK ("limit_value" > 0),
  CONSTRAINT "ai_quotas_action" CHECK ("action" IN ('deny', 'warn', 'throttle'))
);
--> statement-breakpoint
CREATE INDEX "ai_quotas_scope_idx" ON "ai_quotas" USING btree ("scope","scope_value");
--> statement-breakpoint

CREATE TABLE "ai_global_cutoff" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "is_enabled" integer DEFAULT 0 NOT NULL,
  "reason" text,
  "enabled_at" timestamp with time zone,
  "enabled_by" uuid,
  "disabled_at" timestamp with time zone,
  "disabled_by" uuid,
  CONSTRAINT "ai_global_cutoff_singleton" CHECK ("id" = 1)
);
--> statement-breakpoint
ALTER TABLE "ai_global_cutoff" ADD CONSTRAINT "ai_global_cutoff_enabled_by_profiles_id_fk"
  FOREIGN KEY ("enabled_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_global_cutoff" ADD CONSTRAINT "ai_global_cutoff_disabled_by_profiles_id_fk"
  FOREIGN KEY ("disabled_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Guardados manuales (GUARDADOS.md).
CREATE TABLE "manual_saves" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "schema_version" integer DEFAULT 1 NOT NULL,
  "name" text NOT NULL,
  "source_revision" integer NOT NULL,
  "source_branch_id" uuid NOT NULL,
  "minute" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "snapshot" jsonb NOT NULL,
  "snapshot_hash" text NOT NULL,
  "engine_version" integer NOT NULL,
  "metadata_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "manual_saves_run_name_unique" UNIQUE("run_id","name"),
  CONSTRAINT "manual_saves_status" CHECK ("status" IN ('active', 'replaced', 'deleted')),
  CONSTRAINT "manual_saves_hash" CHECK ("snapshot_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "manual_saves_snapshot_object" CHECK (jsonb_typeof("snapshot") = 'object')
);
--> statement-breakpoint
CREATE INDEX "manual_saves_run_created_idx" ON "manual_saves" USING btree ("run_id","created_at");
--> statement-breakpoint
ALTER TABLE "manual_saves" ADD CONSTRAINT "manual_saves_run_id_runs_id_fk"
  FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "manual_saves" ADD CONSTRAINT "manual_saves_owner_id_profiles_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Registro de operaciones (T3-06/T3-08): idempotencia y replay de acciones y guardados.
CREATE TABLE "operation_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "idempotency_key" text NOT NULL,
  "kind" text NOT NULL,
  "request_digest" text NOT NULL,
  "result_public" jsonb,
  "branch_id" uuid NOT NULL,
  "revision" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "operation_records_run_key_unique" UNIQUE("run_id","idempotency_key"),
  CONSTRAINT "operation_records_key" CHECK ("idempotency_key" ~ '^[A-Za-z0-9._:-]{16,128}$'),
  CONSTRAINT "operation_records_digest" CHECK ("request_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE INDEX "operation_records_run_created_idx" ON "operation_records" USING btree ("run_id","created_at");
--> statement-breakpoint
ALTER TABLE "operation_records" ADD CONSTRAINT "operation_records_run_id_runs_id_fk"
  FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "operation_records" ADD CONSTRAINT "operation_records_owner_id_profiles_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Permisos mínimos del rol de aplicación.
-- Transiciones (Fase A): la app actualiza el estado del motor, la revisión,
-- la rama (al cargar un guardado) y el sello temporal; nada más de runs.
GRANT UPDATE (engine_state, revision, branch_id, updated_at) ON runs TO meridiano_app;
GRANT SELECT, INSERT, UPDATE ON manual_saves TO meridiano_app;
GRANT SELECT, INSERT ON operation_records TO meridiano_app;
GRANT SELECT, INSERT ON ai_usage TO meridiano_app;
GRANT SELECT ON ai_quotas TO meridiano_app;
GRANT SELECT ON ai_global_cutoff TO meridiano_app;
GRANT SELECT ON ai_connections TO meridiano_app;
