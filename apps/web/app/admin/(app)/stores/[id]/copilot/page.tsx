import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { StoreLogo } from '@/components/ui';
import { CopilotHub } from './CopilotHub';
import type { CopilotMode } from '@/lib/agent/copilot-router';

export const dynamic = 'force-dynamic';

interface SessionRow {
  id: string;
  mode: CopilotMode;
  title: string | null;
  created_at: string;
  updated_at: string;
  preview: string | null;
  preview_role: 'user' | 'assistant' | null;
  message_count: number;
}

interface ProductRow {
  id: string;
  enriched_title: string;
  price_cents: number;
  image_url: string | null;
}

/**
 * Per-store Copilote hub — one chat surface with five modes (Recherche,
 * Curation, Ads, Médias, Dev). Server-loads the store + an initial bundle
 * of contextual data (products + assets) so the client can pre-render the
 * sidebar without an extra round-trip. Sessions are listed for every mode;
 * the client picks the right pool when the operator switches mode.
 */
export default async function CopilotHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; session?: string }>;
}) {
  const { id } = await params;
  const { mode: modeParam, session: sessionParam } = await searchParams;
  const db = getDbRead();

  const storeRes = await db.query<{
    id: string;
    slug: string;
    name: string;
    niche: string;
    logo_emoji: string;
    primary_color: string;
    status: string;
    mode: string | null;
  }>(
    `SELECT id, slug, name, niche, logo_emoji, primary_color, status, mode
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [id],
  );
  const store = storeRes.rows[0];
  if (!store) notFound();

  // Pull every session for this store, regardless of mode — the client
  // filters by active mode and we keep the round-trip count down.
  const sessionsRes = await db.query<SessionRow>(
    `SELECT s.id, s.mode, s.title, s.created_at, s.updated_at,
            (SELECT content FROM dropship_copilot_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS preview,
            (SELECT role FROM dropship_copilot_messages m
                WHERE m.session_id = s.id AND m.role IN ('user','assistant')
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS preview_role,
            (SELECT COUNT(*) FROM dropship_copilot_messages m WHERE m.session_id = s.id)::int AS message_count
       FROM dropship_copilot_sessions s
       WHERE s.store_id = $1
       ORDER BY s.updated_at DESC
       LIMIT 100`,
    [id],
  );

  const productsRes = await db.query<ProductRow>(
    `SELECT id, enriched_title, price_cents, image_url
       FROM dropship_store_products
       WHERE store_id = $1
       ORDER BY created_at ASC`,
    [id],
  );

  const validModes: CopilotMode[] = ['research', 'curation', 'ads', 'medias', 'dev'];
  const initialMode: CopilotMode = validModes.includes(modeParam as CopilotMode)
    ? (modeParam as CopilotMode)
    : 'curation';

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <header className="flex items-end justify-between gap-4 shrink-0">
        <div>
          <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">Copilote hub</p>
          <h1 className="mt-0.5 text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-[-0.035em] text-zinc-900 leading-[1.02] inline-flex items-center gap-3">
            <StoreLogo emoji={store.logo_emoji} size={28} strokeWidth={1.5} />
            {store.name}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Un chat, cinq modes. Niche : <span className="font-medium text-zinc-900">{store.niche}</span>.
          </p>
        </div>
        <Link
          href={`/shop/${store.slug}`}
          target="_blank"
          className="text-sm px-4 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-blue-50 hover:text-zinc-900 transition-colors"
        >
          Voir le store
        </Link>
      </header>

      <CopilotHub
        storeId={store.id}
        storeSlug={store.slug}
        storeName={store.name}
        initialMode={initialMode}
        initialSessionId={sessionParam ?? null}
        initialSessions={sessionsRes.rows}
        initialProducts={productsRes.rows}
      />
    </div>
  );
}
