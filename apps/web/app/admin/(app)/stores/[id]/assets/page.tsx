import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDbRead } from '@/lib/db';
import { ASSET_KINDS, type AssetKind } from '@/lib/agent/asset-regenerator';
import { PageHeader } from '../../../../_components/AdminUI';
import { AssetRegenerator } from './AssetRegenerator';

export const dynamic = 'force-dynamic';

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  niche: string;
  hero_image_url: string | null;
  cutout_image_url: string | null;
  lifestyle_images: unknown;
  promo_video_url: string | null;
}

interface RunRow {
  id: string;
  asset_kind: AssetKind | 'all';
  prompt: string | null;
  reference_image_url: string | null;
  result_url: string | null;
  status: 'pending' | 'running' | 'success' | 'error';
  error_message: string | null;
  is_current: boolean;
  created_at: Date | string;
  completed_at: Date | string | null;
}

interface ProductRow {
  enriched_title: string | null;
  image_url: string | null;
}

export default async function StoreAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDbRead();

  const storeRes = await db.query<StoreRow>(
    `SELECT id, slug, name, niche, hero_image_url, cutout_image_url, lifestyle_images, promo_video_url
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [id],
  );
  const store = storeRes.rows[0];
  if (!store) notFound();

  const productRes = await db.query<ProductRow>(
    `SELECT enriched_title, image_url
       FROM dropship_store_products
      WHERE store_id = $1 AND image_url IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 1`,
    [id],
  );
  const product = productRes.rows[0] ?? null;

  const runsRes = await db.query<RunRow>(
    `SELECT id, asset_kind, prompt, reference_image_url, result_url, status,
            error_message, is_current, created_at, completed_at
       FROM dropship_asset_runs
      WHERE store_id = $1
      ORDER BY created_at DESC`,
    [id],
  );

  // Group runs by asset_kind, cap at 10 per slot for the history strip.
  const grouped: Record<AssetKind, RunRow[]> = {
    hero: [],
    cutout: [],
    'lifestyle-1': [],
    'lifestyle-2': [],
    'lifestyle-3': [],
    promo: [],
  };
  for (const r of runsRes.rows) {
    const k = r.asset_kind;
    if (k === 'all') continue;
    if (grouped[k].length < 10) grouped[k].push(r);
  }

  const lifestyleImages = Array.isArray(store.lifestyle_images)
    ? (store.lifestyle_images as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];

  const currentUrlByKind: Record<AssetKind, string | null> = {
    hero: store.hero_image_url,
    cutout: store.cutout_image_url,
    'lifestyle-1': lifestyleImages[0] ?? null,
    'lifestyle-2': lifestyleImages[1] ?? null,
    'lifestyle-3': lifestyleImages[2] ?? null,
    promo: store.promo_video_url,
  };

  return (
    <div className="space-y-10">
      <div>
        <Link
          href={`/admin/stores/${id}`}
          className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          ← Retour au store
        </Link>
        <div className="mt-2">
          <PageHeader
            kicker={`Production · Assets · ${store.niche}`}
            title={
              <>
                Assets de <em className="italic text-zinc-500">{store.name}</em>
              </>
            }
            lede={
              <>
                Régénère chaque visuel sans toucher au produit. Le prompt est éditable, l’historique
                conserve les 10 derniers runs et un clic suffit pour revenir à une version
                précédente. Le storefront <code className="font-mono text-zinc-700">/shop/{store.slug}</code>{' '}
                reflète immédiatement la version courante.
              </>
            }
          />
        </div>
      </div>

      {!product?.image_url && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl px-5 py-4 text-sm text-amber-900">
          <strong className="font-medium">Aucun produit de référence.</strong> Aucune image produit
          n’est associée à ce store — la régénération ne peut pas s’appuyer sur un visuel source.
          Importe un produit avec une image avant d’utiliser cette page.
        </div>
      )}

      <div className="space-y-6">
        {ASSET_KINDS.map((kind) => (
          <AssetRegenerator
            key={kind}
            storeId={store.id}
            kind={kind}
            currentUrl={currentUrlByKind[kind]}
            runs={grouped[kind].map((r) => ({
              id: r.id,
              prompt: r.prompt,
              resultUrl: r.result_url,
              status: r.status,
              errorMessage: r.error_message,
              isCurrent: r.is_current,
              createdAt: typeof r.created_at === 'string' ? r.created_at : r.created_at.toISOString(),
            }))}
            referenceImageUrl={product?.image_url ?? null}
          />
        ))}
      </div>
    </div>
  );
}
