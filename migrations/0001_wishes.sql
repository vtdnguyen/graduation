CREATE TABLE IF NOT EXISTS wishes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 600),
  created_at INTEGER NOT NULL,
  sender_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS wishes_sender_time ON wishes(sender_hash, created_at);
