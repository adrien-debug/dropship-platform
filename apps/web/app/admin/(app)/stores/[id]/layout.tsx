import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { StoreLogo } from '@/components/ui';
import { StoreTabsBar } from './_components/StoreTabsBar';

export const dynamic = 'force-dynamic';

/**
 * Store layout — Cockpit migration notes:
 *   - Per-store nav rendered via StoreTabsBar (Cockpit tokens).
 *   - Breadcrumb kept (lightweight, context-useful).
 *   - Data fetch (store name/slug/status) preserved for breadcrumb + StoreTabsBar.
 */
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDbRead();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { rows } = await db.query<{ id: string; slug: string; name: string; logo_emoji: string; status: string }>(
    isUuid
      ? `SELECT id, slug, name, logo_emoji, status FROM dropship_stores WHERE id = $1 LIMIT 1`
      : `SELECT id, slug, name, logo_emoji, status FROM dropship_stores WHERE slug = $1 LIMIT 1`,
    [id],
  );
  const store = rows[0];
  if (!store) notFound();

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Breadcrumb — re-skinned with --ct-* tokens */}
      <nav
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, flexShrink: 0,
        }}
        aria-label="Fil d'Ariane"
      >
        <Link
          href="/admin/stores"
          style={{ color: 'var(--ct-text-muted)', textDecoration: 'none', transition: 'color var(--ct-dur-base)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ct-text-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ct-text-muted)'; }}
        >
          ← Stores
        </Link>
        <span style={{ color: 'var(--ct-border-strong)' }}>/</span>
        <span style={{ color: 'var(--ct-text-muted)', display: 'inline-flex' }}>
          <StoreLogo emoji={store.logo_emoji} size={16} />
        </span>
        <span style={{ fontWeight: 500, color: 'var(--ct-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {store.name}
        </span>
        {store.status !== 'active' && (
          <span style={{
            fontSize: 11, padding: '2px 8px',
            background: 'var(--ct-accent-soft)',
            color: 'var(--ct-accent-strong)',
            borderRadius: 9999, fontWeight: 500,
            border: '1px solid var(--ct-border-accent)',
          }}>
            {store.status}
          </span>
        )}
      </nav>

      <StoreTabsBar storeId={store.id} />

      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}
