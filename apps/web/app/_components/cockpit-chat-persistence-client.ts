/**
 * Client-side ChatPersistence implementation.
 * Each method proxies to the server API routes — no direct DB access.
 * Safe to import in 'use client' components.
 */
import type { ChatPersistence, ChatMessage } from '@hearst/cockpit-shell';

export function createClientChatPersistence(): ChatPersistence {
  return {
    async createChat(): Promise<string> {
      const res = await fetch('/api/cockpit-chat/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`createChat failed: ${res.status}`);
      const data = (await res.json()) as { id: string };
      return data.id;
    },

    async loadMessages(chatId: string): Promise<ChatMessage[]> {
      const res = await fetch(`/api/cockpit-chat/chats/${chatId}/messages`);
      if (!res.ok) throw new Error(`loadMessages failed: ${res.status}`);
      const data = (await res.json()) as { messages: ChatMessage[] };
      return data.messages;
    },

    async saveMessage(chatId: string, msg: ChatMessage): Promise<void> {
      const res = await fetch(`/api/cockpit-chat/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error(`saveMessage failed: ${res.status}`);
    },
  };
}
