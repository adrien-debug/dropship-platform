-- 030_cockpit_chat.sql
-- Cockpit chat persistence: conversations + messages.
-- Idempotent: safe to re-run manually against the Railway instance.

CREATE TABLE IF NOT EXISTS dropship_cockpit_chats (
  id          text        PRIMARY KEY,
  admin_user  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dropship_cockpit_chat_messages (
  id             text    PRIMARY KEY,
  chat_id        text    NOT NULL REFERENCES dropship_cockpit_chats(id) ON DELETE CASCADE,
  role           text    NOT NULL CHECK (role IN ('user', 'assistant')),
  content        text    NOT NULL,
  created_at_ms  bigint  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cockpit_chat_messages_chat_id_created_at
  ON dropship_cockpit_chat_messages (chat_id, created_at_ms);
