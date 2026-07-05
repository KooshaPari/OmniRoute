-- Migration 015: Memories table for persistent context storage.

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  session_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('factual', 'episodic', 'procedural', 'semantic')),
  key TEXT,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_api_key ON memories(api_key_id);
CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at);
