-- 030_cockpit_chat.down.sql
-- Rollback: drop in reverse dependency order.

DROP TABLE IF EXISTS dropship_cockpit_chat_messages;
DROP TABLE IF EXISTS dropship_cockpit_chats;
