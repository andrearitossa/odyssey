-- User and story storage. Legacy users columns remain for existing databases.

-- Anonymous sessions table (renamed from original users table)
-- CREATE TABLE IF NOT EXISTS sessions_anonymous (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   token TEXT UNIQUE NOT NULL,
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   expires_at DATETIME NOT NULL,
--   last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
-- );

-- User profiles. Guest users have guest: IDs and @guest.invalid emails.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,                        -- User profile picture URL
  language TEXT DEFAULT 'English',         -- User preferred language
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT UNIQUE NOT NULL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- World definitions
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT
);

-- Active user sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  world_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (world_id) REFERENCES worlds(id)
);

-- Message history for conversations
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('user', 'narrator')) NOT NULL,
  content TEXT NOT NULL,
  chapter_number INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Story models for each session (MPC storytelling system)
CREATE TABLE IF NOT EXISTS story_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  core_theme_moral_message TEXT NOT NULL,      -- Core theme and moral message
  genre_style_voice TEXT NOT NULL,             -- Genre, style, narrative voice
  setting TEXT NOT NULL,                       -- Setting constraints and world rules
  protagonist TEXT NOT NULL,                   -- Protagonist - user is the main character
  conflict_sources TEXT NOT NULL,              -- Primary conflict sources
  intended_impact TEXT NOT NULL,               -- Intended emotional and intellectual impact
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Chapters for the story (managed by Chapter Manager)
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT CHECK(status IN ('history', 'current', 'future')) NOT NULL,
  decomposition TEXT,                          -- Single line decomposition from Optimizer
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  UNIQUE(session_id, chapter_number)
);

-- Essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_world_id ON sessions(world_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_chapter_number ON messages(session_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_story_models_session_id ON story_models(session_id);
CREATE INDEX IF NOT EXISTS idx_chapters_session_id ON chapters(session_id);
CREATE INDEX IF NOT EXISTS idx_chapters_session_status ON chapters(session_id, status);

-- User lookup indexes
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Short playable premises for shared discovery worlds.
INSERT OR IGNORE INTO worlds (id, title, description) VALUES ('titanic-adventure', 'The Titanic', 'An icy night aboard the Titanic. Your younger sibling is missing below deck as the lifeboats begin to fill. Find them and choose whom you can help before the last boat leaves.');
INSERT OR IGNORE INTO worlds (id, title, description) VALUES ('the-kreutzer-sonata', 'The Kreutzer Sonata', 'A stranger on a night train confesses to a terrible act. His story contradicts a letter you found in the carriage. Uncover what happened before the next station, where someone is waiting for him.');
INSERT OR IGNORE INTO worlds (id, title, description) VALUES ('a-farewell-to-arms', 'A Farewell to Arms', 'The bridge closes at dawn. You are driving an ambulance through a retreat on the Italian front, carrying a wounded friend and a letter that could get you both across the border. Decide what you are willing to risk.');
INSERT OR IGNORE INTO worlds (id, title, description) VALUES ('family-guy', 'Family Guy', 'A borrowed time machine disappears in Quahog on the morning of the town parade. You promised to return it by noon. Follow a trail of absurd mishaps before someone accidentally rewrites the town.');

-- Guest sessions and optional password accounts. Tokens are stored only as hashes.
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
-- Seeded and legacy worlds have no owner and remain public. New worlds are private.
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
-- Only new/unopened sessions opt in. Legacy transcripts remain on the text engine.
CREATE TABLE IF NOT EXISTS session_story_state (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id),
  version INTEGER NOT NULL,
  state_json TEXT NOT NULL
);
-- Open prose memory; old structured state remains untouched for historical sessions.
CREATE TABLE IF NOT EXISTS session_story_memory (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id),
  descriptor TEXT NOT NULL
);
