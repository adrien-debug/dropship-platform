/**
 * GET  /api/cockpit-chat/chats/[id]/messages  → { messages: ChatMessage[] }
 * POST /api/cockpit-chat/chats/[id]/messages  → { ok: true }
 * Auth: Basic Auth enforced by middleware for all non-PUBLIC_EXCEPTIONS API routes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCockpitChatPersistence } from '@/lib/cockpit/chat-persistence';

const ChatMessageSchema = z.object({
  id: z.string().min(1).max(128),
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(50000),
  createdAt: z.number().int().positive(),
});
const PostBodySchema = z.object({ message: ChatMessageSchema });

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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid message payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { message } = parsed.data;

  try {
    const persistence = createCockpitChatPersistence(adminUser);
    await persistence.saveMessage(chatId, message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[cockpit-chat/messages] POST error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
