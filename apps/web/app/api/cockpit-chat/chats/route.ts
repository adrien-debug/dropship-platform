/**
 * POST /api/cockpit-chat/chats
 * Creates a new Cockpit chat session. Returns { id }.
 * Auth: Basic Auth already enforced by middleware (all /api/* routes except PUBLIC_EXCEPTIONS).
 */
import { NextResponse } from 'next/server';
import { createCockpitChatPersistence } from '@/lib/cockpit/chat-persistence';

export const runtime = 'nodejs';

export async function POST() {
  const adminUser = (process.env.ADMIN_USERNAME ?? '').trim();
  if (!adminUser) {
    return NextResponse.json({ error: 'ADMIN_USERNAME not configured' }, { status: 500 });
  }

  try {
    const persistence = createCockpitChatPersistence(adminUser);
    const id = await persistence.createChat();
    return NextResponse.json({ id });
  } catch (err) {
    console.error('[cockpit-chat/chats] POST error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
