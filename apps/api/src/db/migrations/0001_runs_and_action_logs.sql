-- Migration: 0001_runs_and_action_logs
-- Created: 2026-10-28

CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  definition_id TEXT NOT NULL,
  definition_hash TEXT NOT NULL,
  engine_version INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  minute INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  prev_version INTEGER NOT NULL,
  next_version INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  action_params JSONB NOT NULL,
  idempotency_key TEXT NOT NULL,
  events JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO migrations (id) VALUES ('0001_runs_and_action_logs') ON CONFLICT (id) DO NOTHING;