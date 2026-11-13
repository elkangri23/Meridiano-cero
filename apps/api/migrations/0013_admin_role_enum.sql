-- Fase 1 del panel de administración: el rol pasa de text a ENUM.
--
-- La columna profiles.role YA EXISTE como text desde 0000_base.sql, así que
-- la versión original de esta migración (ADD COLUMN role) fallaba en
-- producción con «column already exists». Aquí solo se convierte el tipo.
-- Además 0001_local_profile.sql dejó un CHECK (profile_role) que solo
-- permitía 'player': sin quitarlo ningún perfil podría ser admin/superadmin.
-- La migración es idempotente contra el estado real de producción.

-- El tipo ENUM no existe aún en producción; se crea si falta.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE role AS ENUM ('player', 'admin', 'superadmin');
  END IF;
END $$;

-- Quitar ANTES de convertir el CHECK que solo permitía 'player' (de
-- 0001_local_profile.sql): su expresión compara role con 'player'::text y
-- tras la conversión ya no existe el operador role = text, así que el
-- ALTER TYPE fallaría al validar las filas. Sin quitarlo, además, ningún
-- perfil podría ser admin/superadmin.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profile_role;

-- Conversión text -> ENUM. Todos los valores actuales son 'player'
-- (comprobado en producción antes de escribir esta migración), así que el
-- USING no puede fallar por valores fuera del ENUM. El default se quita
-- antes de convertir: Postgres no puede castear 'player'::text a ENUM
-- automáticamente y el ALTER TYPE fallaría («default for column "role"
-- cannot be cast automatically to type role»); se vuelve a poner después.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'role' AND data_type = 'text'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE profiles ALTER COLUMN role TYPE role USING role::role;
  END IF;
END $$;

-- El default 'player' se vuelve a poner tras la conversión.
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'player';
