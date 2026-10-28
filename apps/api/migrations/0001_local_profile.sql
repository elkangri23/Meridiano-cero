ALTER TABLE profiles ADD CONSTRAINT profile_role CHECK (role = 'player');
ALTER TABLE sessions ADD CONSTRAINT session_digest CHECK (token_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE sessions ADD CONSTRAINT session_csrf CHECK (csrf_token ~ '^[A-Za-z0-9_-]{43}$');
ALTER TABLE sessions ADD CONSTRAINT session_expiry CHECK (expires_at > created_at);
INSERT INTO profiles (local_key, display_name, role)
VALUES ('development', 'Detective local de pruebas', 'player')
ON CONFLICT (local_key) DO NOTHING;
GRANT USAGE ON SCHEMA public TO meridiano_app;
GRANT SELECT ON profiles TO meridiano_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions TO meridiano_app;

