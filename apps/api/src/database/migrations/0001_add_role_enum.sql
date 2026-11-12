-- Add role ENUM type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE role AS ENUM ('player', 'admin', 'superadmin');
  END IF;
END $$;

-- Add role column to profiles table with default 'player'
ALTER TABLE profiles
ADD COLUMN role role NOT NULL DEFAULT 'player';

-- Add constraint to ensure role is one of the allowed values (extra safety)
ALTER TABLE profiles
ALTER COLUMN role TYPE role USING role::role;