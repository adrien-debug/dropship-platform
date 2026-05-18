/**
 * Server-side Cockpit chat persistence backed by Postgres (direct via getDb()).
 * Used by the API routes — never imported client-side.
 */
import type { ChatPersistence, ChatMessage } from '@hearst/cockpit-shell';
import { getDb } from '@/lib/db';

export function createCockpitChatPersistence(adminUser: string): ChatPersistence {
  return {
    async createChat(): Promise<string> {
      const id = crypto.randomUUID();
      const db = getDb();
      await db.query(
        `INSERT INTO dropship_cockpit_chats (id, admin_user) VALUES ($1, $2)`,
        [id, adminUser],
      );
      return id;
    },

    async loadMessages(chatId: string): Promise<ChatMessage[]> {
      const db = getDb();
      // RLS-like: only return messages for chats that belong to this admin.
      const { rows } = await db.query<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        created_at_ms: string;
      }>(
        `SELECT m.id, m.role, m.content, m.created_at_ms
         FROM dropship_cockpit_chat_messages m
         JOIN dropship_cockpit_chats c ON c.id = m.chat_id
         WHERE m.chat_id = $1 AND c.admin_user = $2
         ORDER BY m.created_at_ms ASC`,
        [chatId, adminUser],
      );
      return rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        createdAt: Number(r.created_at_ms),
      }));
    },

    async saveMessage(chatId: string, msg: ChatMessage): Promise<void> {
      const db = getDb();
      // Ownership check inline: the INSERT only executes if the chat belongs
      // to the current adminUser. If the chat doesn't exist or belongs to
      // another admin the SELECT returns no rows and nothing is inserted.
      await db.query(
        `INSERT INTO dropship_cockpit_chat_messages (id, chat_id, role, content, created_at_ms)
         SELECT $1, $2, $3, $4, $5
         FROM dropship_cockpit_chats
         WHERE id = $2 AND admin_user = $6
         ON CONFLICT (id) DO NOTHING`,
        [msg.id, chatId, msg.role, msg.content, msg.createdAt, adminUser],
      );
      // Keep updated_at fresh on the parent chat row — same ownership guard.
      await db.query(
        `UPDATE dropship_cockpit_chats SET updated_at = now() WHERE id = $1 AND admin_user = $2`,
        [chatId, adminUser],
      );
    },
  };
}
