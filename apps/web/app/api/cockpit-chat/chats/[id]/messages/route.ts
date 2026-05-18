/**
 * GET  /api/cockpit-chat/chats/[id]/messages  → { messages: ChatMessage[] }
 * POST /api/cockpit-chat/chats/[id]/messages  → { ok: true }
 * Auth: Basic Auth enforced by middleware for all non-PUBLIC_EXCEPTIONS API routes.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { ChatMessage } from '@hearst/cockpit-shell';
import { createCockpitChatPersistence } from '@/lib/cockpit/chat-persistence';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id: chatId } = await params;
  const adminUser = (process.env.ADMIN_USERNAME ?? '').trim();
  if (!adminUser) {
    return NextResponse.json({ error: 'ADMIN_USERNAME not configured' }, { status: 500 });
  }

  try {
    const persistence = createCockpitChatPersistence(adminUser);
    const messages = await persistence.loadMessages(chatId);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error('[cockpit-chat/messages] GET error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id: chatId } = await params;
  const adminUser = (process.env.ADMIN_USERNAME ?? '').trim();
  if (!adminUser) {
    return NextResponse.json({ error: 'ADMIN_USERNAME not configured' }, { status: 500 });
  }

  let message: ChatMessage;
  try {
    const body = (await req.json()) as { message: ChatMessage };
    message = body.message;
    if (!message?.id || !message?.role || !message?.content) {
      return NextResponse.json({ error: 'Invalid message payload' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const persistence = createCockpitChatPersistence(adminUser);
    await persistence.saveMessage(chatId, message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[cockpit-chat/messages] POST error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
