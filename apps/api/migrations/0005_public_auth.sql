-- 0005_public_auth: credenciales y verificación para el registro público (Fase B).
--
-- Contexto Fase B (2026-11-05): el registro público de
-- apps/api/src/auth/public-auth.ts era código muerto y, además, no podía
-- funcionar de verdad: `profiles` no guardaba ninguna credencial (el hash se
-- calculaba y se descartaba), la recuperación guardaba el token solo en
-- memoria y su confirmación actualizaba "el primer perfil" de la base.
--
-- Decisiones:
-- * Contraseñas con Argon2id (hash `$argon2id$...`, verificado en la API con
--   la librería `argon2`); la columna acepta NULL solo para el perfil local
--   de desarrollo, que no tiene contraseña.
-- * Verificación de email y recuperación con tokens de un solo uso guardados
--   en base de datos (hash SHA-256 del token, nunca el token en claro).
-- * El envío de correo lo hace la API solo si hay `RESEND_API_KEY` y
--   `MAIL_FROM` en el entorno (ver apps/api/src/auth/mailer.ts); sin ellas
--   el registro y la recuperación siguen funcionando, pero la verificación
--   queda pendiente y la API registra EMAIL_NOT_CONFIGURED sin el token.
-- * Como en las migraciones 0001-0004, los GRANT son manuales y no están en
--   el modelo drizzle.

ALTER TABLE profiles ADD COLUMN password_hash text;
ALTER TABLE profiles ADD COLUMN email_verified_at timestamp with time zone;
ALTER TABLE profiles ADD CONSTRAINT profile_password_format
  CHECK (password_hash IS NULL OR password_hash LIKE '$argon2id$%');

CREATE TABLE "email_verifications" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "profile_id" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_verifications_token_digest" CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "email_verifications_expiry" CHECK (expires_at > created_at)
);
--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_profile_id_profiles_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "email_verifications_profile_idx" ON "email_verifications" USING btree ("profile_id");

CREATE TABLE "recovery_tokens" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "profile_id" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "recovery_tokens_token_digest" CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "recovery_tokens_expiry" CHECK (expires_at > created_at)
);
--> statement-breakpoint
ALTER TABLE "recovery_tokens" ADD CONSTRAINT "recovery_tokens_profile_id_profiles_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "recovery_tokens_profile_idx" ON "recovery_tokens" USING btree ("profile_id");

GRANT SELECT, INSERT ON profiles TO meridiano_app;
GRANT UPDATE (password_hash, email_verified_at, local_key, display_name) ON profiles TO meridiano_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_verifications TO meridiano_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON recovery_tokens TO meridiano_app;
