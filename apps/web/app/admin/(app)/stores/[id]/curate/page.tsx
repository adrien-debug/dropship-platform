import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { CurationChat } from './CurationChat';

export const dynamic = 'force-dynamic';

interface SessionRow {
  id: string;
  created_at: string;
  updated_at: string;
  preview: string | null;
  preview_role: 'user' | 'assistant' | null;
  message_count: number;
}

interface ProductRow {
  id: string;
  supplier: string;
  enriched_title: string;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  medusa_product_id: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  created_at: string;
}

export default async function StoreCuratePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { id } = await params;
  const { session: requestedSession } = await searchParams;
  const db = getDbRead();

  const storeRes = await db.query<{
    id: string;
    slug: string;
    name: string;
    niche: string;
    logo_emoji: string;
    primary_color: string;
    status: string;
  }>(
    `SELECT id, slug, name, niche, logo_emoji, primary_color, status
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [id],
  );
  const store = storeRes.rows[0];
  if (!store) notFound();

  const productsRes = await db.query<ProductRow>(
    `SELECT id, supplier, enriched_title, price_cents, cost_cents,
            image_url, medusa_product_id, created_at
       FROM dropship_store_products WHERE store_id = $1 ORDER BY created_at ASC`,
    [id],
  );

  const sessionsRes = await db.query<SessionRow>(
    `SELECT s.id, s.created_at, s.updated_at,
            (SELECT content FROM dropship_curation_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS preview,
            (SELECT role FROM dropship_curation_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS preview_role,
            (SELECT COUNT(*) FROM dropship_curation_messages m WHERE m.session_id = s.id)::int AS message_count
       FROM dropship_curation_sessions s
       WHERE s.store_id = $1
       ORDER BY s.updated_at DESC
       LIMIT 20`,
    [id],
  );

  const activeSessionId = requestedSession || sessionsRes.rows[0]?.id || null;
  let initialMessages: MessageRow[] = [];
  if (activeSessionId) {
    const sess = await db.query<{ id: string }>(
      `SELECT id FROM dropship_curation_sessions WHERE id = $1 AND store_id = $2 LIMIT 1`,
      [activeSessionId, id],
    );
    if (sess.rows[0]) {
      const msgRes = await db.query<MessageRow>(
        `SELECT id, role, content, tool_name, tool_input, tool_output, created_at
           FROM dropship_curation_messages
           WHERE session_id = $1
           ORDER BY created_at ASC, id ASC`,
        [activeSessionId],
      );
      initialMessages = msgRes.rows;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/stores" className="text-zinc-400 hover:underline">← Stores</Link>
        <span className="text-zinc-300">/</span>
        <Link href={`/admin/stores/${store.id}`} className="text-zinc-400 hover:underline">
          {store.name}
        </Link>
        <span className="text-zinc-300">/</span>
        <span className="text-zinc-700 font-medium">Curation</span>
      </div>

      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">Curation copilot</p>
          <h1 className="mt-1 text-3xl font-serif text-zinc-900 leading-tight">
            <span className="mr-2">{store.logo_emoji || '🛍️'}</span>
            {store.name}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Discute avec l’agent pour ajouter, retirer, repricer ou réécrire les produits du catalogue. Niche : <span className="font-medium text-zinc-700">{store.niche}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/shop/${store.slug}`}
            target="_blank"
            className="text-sm px-4 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
          >
            Voir le store →
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <CurationChat
          storeId={store.id}
          storeSlug={store.slug}
          initialSessions={sessionsRes.rows}
          initialSessionId={activeSessionId}
          initialMessages={initialMessages}
          initialProducts={productsRes.rows}
        />
      </div>
    </div>
  );
}
