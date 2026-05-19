import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
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
  const storeId = await resolveStoreId(id);
  if (!storeId) notFound();
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
    [storeId],
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
    [storeId],
  );

  const productsRes = await db.query<ProductRow>(
    `SELECT id, enriched_title, price_cents, image_url
       FROM dropship_store_products
       WHERE store_id = $1
       ORDER BY created_at ASC`,
    [storeId],
  );

  const validModes: CopilotMode[] = ['research', 'curation', 'ads', 'medias', 'dev'];
  const initialMode: CopilotMode = validModes.includes(modeParam as CopilotMode)
    ? (modeParam as CopilotMode)
    : 'curation';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--ct-text-muted)', fontWeight: 700 }}>Copilote hub</p>
          <h1 className="ct-title" style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <StoreLogo emoji={store.logo_emoji} size={24} strokeWidth={1.5} />
            {store.name}
          </h1>
          <p style={{ marginTop: 4, fontSize: 12, color: 'var(--ct-text-muted)' }}>
            Un chat, cinq modes. Niche : <span style={{ fontWeight: 600, color: 'var(--ct-text-body)' }}>{store.niche}</span>.
          </p>
        </div>
        <Link
          href={`/shop/${store.slug}`}
          target="_blank"
          style={{ fontSize: 13, padding: '6px 16px', borderRadius: 8, border: '1px solid var(--ct-border)', background: 'var(--ct-surface-2)', color: 'var(--ct-text-muted)', textDecoration: 'none' }}
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
