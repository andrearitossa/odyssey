-- Only new/unopened sessions opt in. Legacy transcripts remain on the text engine.
CREATE TABLE IF NOT EXISTS session_story_state (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id),
  version INTEGER NOT NULL,
  state_json TEXT NOT NULL
);
