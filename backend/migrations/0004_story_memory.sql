-- Open prose memory; old structured state remains untouched for historical sessions.
CREATE TABLE IF NOT EXISTS session_story_memory (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id),
  descriptor TEXT NOT NULL
);
