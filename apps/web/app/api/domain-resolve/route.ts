/**
 * GET /api/domain-resolve?host=maison-chic.com
 *
 * P1.1 — Internal endpoint used by the edge middleware to resolve a custom
 * domain to its store slug. The middleware cannot run pg directly (edge
 * runtime), so it calls this Node.js route handler and caches the result
 * in a module-level Map for 60 s.
 *
 * This route is intentionally lightweight — one indexed SELECT, no auth
 * overhead (it's listed in PUBLIC_EXCEPTIONS in middleware.ts). The only
 * data it leaks is the slug for active stores with a configured domain,
 * which is already public via /shop/{slug}.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDbRead } from '@/lib/db';

export const runtime = 'nodejs'; // needs pg — cannot run on edge

export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get('host');
  if (!host) {
    return NextResponse.json({ error: 'missing host' }, { status: 400 });
  }

  // Strip port if present (e.g. localhost:3000 → localhost)
  const cleanHost = host.split(':')[0].toLowerCase();

  const db = getDbRead();
  const { rows } = await db.query<{ slug: string }>(
    `SELECT slug FROM dropship_stores WHERE custom_domain = $1 AND status = 'active' LIMIT 1`,
    [cleanHost],
  );

  if (!rows[0]) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  return NextResponse.json({ slug: rows[0].slug });
}
