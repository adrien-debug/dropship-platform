import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getDbRead } from '@/lib/db';
import { StoreLogo } from '@/components/ui';
import { StoreTabs } from './StoreTabs';
import { StoreLayoutClient } from './StoreLayoutClient';

export const dynamic = 'force-dynamic';

/**
 * Shared layout for the entire `/admin/stores/[id]/*` area.
 *
 * Activates the store copilot in the persistent chat panel so the chat
 * stays visible and stable across all store tabs (overview, catalog,
 * copilot, analytics, settings).
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
  const { rows } = await db.query<{ slug: string; name: string; logo_emoji: string; status: string }>(
    `SELECT slug, name, logo_emoji, status FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [id],
  );
  const store = rows[0];
  if (!store) notFound();

  return (
    <StoreLayoutClient storeId={id} storeSlug={store.slug} storeName={store.name}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 text-sm">
          <Link href="/admin/stores" className="text-zinc-400 hover:text-zinc-900 transition-colors">
            ← Stores
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-600 inline-flex"><StoreLogo emoji={store.logo_emoji} size={18} /></span>
          <span className="font-medium text-zinc-900 truncate">{store.name}</span>
          {store.status !== 'active' && (
            <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">
              {store.status}
            </span>
          )}
        </div>

        <StoreTabs storeId={id} storeSlug={store.slug} />

        <div className="pt-2">{children}</div>
      </div>
    </StoreLayoutClient>
  );
}

