-- Generación de casos (T4-08): jobs persistentes y catálogo publicado.
-- Un job es la ejecución completa del pipeline (9 etapas) para un delito,
-- contenido y duración; un expediente solo entra en el catálogo si pasa la
-- validación v1.5 y la simulación de jugabilidad (la puerta vive en el
-- pipeline, no en SQL: aquí solo se guarda el resultado).

CREATE TABLE generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'queued', -- queued, running, done, failed, cancelled
  crime_type text NOT NULL,
  content_rating text NOT NULL DEFAULT 'familiar', -- familiar, general
  duration text NOT NULL DEFAULT 'medium', -- short, medium, long
  seed integer,
  stage integer NOT NULL DEFAULT 0,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft jsonb,
  case_id text,
  error text,
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  CHECK (content_rating IN ('familiar', 'general')),
  CHECK (duration IN ('short', 'medium', 'long')),
  CHECK (stage >= 0 AND stage <= 9)
);
-- Un solo job activo por usuario (el límite se refuerza también en la API,
-- que es quien devuelve el error legible; el índice evita la carrera).
CREATE UNIQUE INDEX generation_jobs_one_active_per_owner
  ON generation_jobs (owner_id) WHERE status IN ('queued', 'running');
CREATE INDEX generation_jobs_owner_created_idx ON generation_jobs (owner_id, created_at DESC, id);
CREATE INDEX generation_jobs_claim_idx ON generation_jobs (status, lease_expires_at, created_at)
  WHERE status IN ('queued', 'running');

-- Catálogo publicado: solo expedientes validados y simulados. La definición
-- es autocontenida (mecánica, textos, intro y metadatos de catálogo viajan
-- en el JSON); la fila es almacenamiento, no la fuente de verdad del juego.
CREATE TABLE generated_cases (
  case_id text PRIMARY KEY,
  title text NOT NULL,
  crime_type text NOT NULL,
  content_rating text NOT NULL,
  duration text NOT NULL,
  definition jsonb NOT NULL,
  definition_hash text NOT NULL CHECK (definition_hash ~ '^[a-f0-9]{64}$'),
  job_id uuid REFERENCES generation_jobs(id),
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (content_rating IN ('familiar', 'general')),
  CHECK (duration IN ('short', 'medium', 'long')),
  CHECK (jsonb_typeof(definition) = 'object')
);
CREATE INDEX generated_cases_crime_idx ON generated_cases (crime_type, content_rating, created_at DESC, case_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON generation_jobs TO meridiano_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON generated_cases TO meridiano_app;
