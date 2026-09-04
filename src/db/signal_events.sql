-- Signaling event log used by the Postgres long-poll fallback
-- (src/lib/signaling.ts LocalSignaling). Applied automatically at runtime
-- by ensureSchema() — keep in sync with src/db/schema.ts.

CREATE TABLE IF NOT EXISTS signal_events (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS signal_events_room_idx
  ON signal_events (room_id, id);

CREATE INDEX IF NOT EXISTS signal_events_created_at_idx
  ON signal_events (created_at);
