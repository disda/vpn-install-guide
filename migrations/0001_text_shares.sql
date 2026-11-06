CREATE TABLE text_shares (
  id TEXT PRIMARY KEY NOT NULL,
  content TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('text', 'json')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX text_shares_expiry ON text_shares (expires_at);
