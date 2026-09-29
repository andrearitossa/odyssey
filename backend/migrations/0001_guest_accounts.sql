-- Add guest and optional account storage to an existing Odyssey D1 database.
-- Legacy users, stories, and chapters remain untouched.
CREATE TABLE IF NOT EXISTS app_accounts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_sessions_user ON app_sessions(user_id);
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS interaction_requests (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  request_id TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, request_id)
);
CREATE TABLE IF NOT EXISTS world_owners (
  world_id TEXT PRIMARY KEY REFERENCES worlds(id),
  user_id INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS world_owners_user ON world_owners(user_id);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS story_turn_locks (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id),
  request_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
