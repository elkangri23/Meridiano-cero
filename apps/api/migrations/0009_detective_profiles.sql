-- Perfil de detective (§13): alias y avatar pixel art por jugador.
-- La tabla existe en el esquema Drizzle desde la base, pero ninguna
-- migración la creaba: hasta ahora ningún perfil tenía fila y no había
-- API ni UI para poner alias o avatar. El alias es el nombre que se
-- enseña donde hoy sale el nombre del detective; el avatar es una
-- elección cerrada (sin subida de imágenes): 'detective' por defecto.
-- La fila se crea al primer guardado (upsert), no al registrarse.

CREATE TABLE IF NOT EXISTS detective_profiles (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  alias text NOT NULL,
  avatar text NOT NULL DEFAULT 'detective',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (avatar IN ('detective', 'archivista', 'forense', 'inspector', 'rastreador')),
  CHECK (char_length(alias) >= 1 AND char_length(alias) <= 160)
);

-- Como en las migraciones 0001-0008: la app corre como meridiano_app y
-- necesita el permiso explícito sobre la tabla nueva (sin él, SELECT e
-- INSERT fallan con permiso denegado y la ruta devuelve 503).
GRANT SELECT, INSERT, UPDATE ON detective_profiles TO meridiano_app;
