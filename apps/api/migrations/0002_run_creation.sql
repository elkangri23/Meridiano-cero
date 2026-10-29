CREATE TABLE "run_creations" (
	"owner_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_digest" text NOT NULL,
	"run_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_creations_owner_id_idempotency_key_pk" PRIMARY KEY("owner_id","idempotency_key"),
	CONSTRAINT "run_creations_key" CHECK ("run_creations"."idempotency_key" ~ '^[A-Za-z0-9._:-]{16,128}$'),
	CONSTRAINT "run_creations_digest" CHECK ("run_creations"."request_digest" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"definition_id" text NOT NULL,
	"definition_hash" text NOT NULL,
	"engine_version" integer NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"branch_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"engine_state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_owner_id_id_unique" UNIQUE("owner_id","id"),
	CONSTRAINT "runs_revision_positive" CHECK ("runs"."revision" > 0),
	CONSTRAINT "runs_engine_positive" CHECK ("runs"."engine_version" > 0),
	CONSTRAINT "runs_definition_digest" CHECK ("runs"."definition_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "runs_state_object" CHECK (jsonb_typeof("runs"."engine_state") = 'object')
);
--> statement-breakpoint
ALTER TABLE "run_creations" ADD CONSTRAINT "run_creations_owner_id_run_id_runs_owner_id_id_fk" FOREIGN KEY ("owner_id","run_id") REFERENCES "public"."runs"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_owner_created_idx" ON "runs" USING btree ("owner_id","created_at","id");
GRANT SELECT, INSERT, UPDATE, DELETE ON runs, run_creations TO meridiano_app;
