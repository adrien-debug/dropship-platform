import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDbRead } from '@/lib/db';
import { listAdVariantsForStore } from '@/lib/agent/ad-variants';
import { getCampaignPerformance, type CampaignPerformanceRow } from '@/lib/ads/performance';
import { isMetaAdsConfigured } from '@/lib/ads/meta-ads';
import { isTiktokAdsConfigured } from '@/lib/ads/tiktok-ads';
import { PageHeader, SectionCard, StatusPill } from '../../../../_components/AdminUI';
import { GenerateAdsButton } from './GenerateAdsButton';
import { AdsChat, type VariantRow } from './AdsChat';

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

interface ProductRow {
  id: string;
  enriched_title: string;
  image_url: string | null;
  price_cents: number;
}

interface SessionRow {
  id: string;
  created_at: string;
  updated_at: string;
  preview: string | null;
  preview_role: 'user' | 'assistant' | null;
  message_count: number;
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

export default async function StoreAdsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { id } = await params;
  const { session: requestedSession } = await searchParams;
  const db = getDbRead();

  const storeRes = await db.query<StoreRow>(
    `SELECT id, slug, name, niche, hero_image_url, cutout_image_url, lifestyle_images, promo_video_url
       FROM dropship_stores
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  const store = storeRes.rows[0];
  if (!store) notFound();

  const [productsRes, variantsList, performance] = await Promise.all([
    db.query<ProductRow>(
      `SELECT id, enriched_title, image_url, price_cents
         FROM dropship_store_products
        WHERE store_id = $1
        ORDER BY created_at ASC`,
      [id],
    ),
    listAdVariantsForStore(id),
    getCampaignPerformance(id),
  ]);
  const products = productsRes.rows;
  const variants = variantsList;

  // Sessions (shared with curation table — same schema).
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

  // Group variants by product → latest batch.
  const byProduct = new Map<string, typeof variants>();
  for (const v of variants) {
    if (!byProduct.has(v.productId)) byProduct.set(v.productId, []);
    byProduct.get(v.productId)!.push(v);
  }

  // Variant rows for the chat sidebar (latest batch per product).
  const productMap = new Map(products.map((p) => [p.id, p]));
  const chatVariants: VariantRow[] = [];
  for (const [productId, list] of byProduct) {
    const latestBatch = list[0]?.batchId;
    const latest = list.filter((v) => v.batchId === latestBatch);
    const product = productMap.get(productId);
    if (!product) continue;
    for (const v of latest) {
      chatVariants.push({
        id: v.id,
        product_id: productId,
        product_title: product.enriched_title,
        product_image_url: product.image_url,
        channel: v.channel,
        headline: v.headline,
        primary_text: v.primaryText,
        description: v.description,
        cta: v.cta,
        image_url: null,
      });
    }
  }

  const metaConfigured = isMetaAdsConfigured();
  const tiktokConfigured = isTiktokAdsConfigured();

  const lifestyleImages = Array.isArray(store.lifestyle_images)
    ? (store.lifestyle_images as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];

  const sharedVisuals = [
    store.hero_image_url && { label: 'Hero', url: store.hero_image_url, kind: 'image' as const },
    store.cutout_image_url && { label: 'Cutout', url: store.cutout_image_url, kind: 'image' as const },
    ...lifestyleImages.map((url, i) => ({ label: `Lifestyle ${i + 1}`, url, kind: 'image' as const })),
    store.promo_video_url && { label: 'Promo video', url: store.promo_video_url, kind: 'video' as const },
  ].filter((v): v is { label: string; url: string; kind: 'image' | 'video' } => !!v);

  return (
    <div className="space-y-10">
      <div>
        <Link href={`/admin/stores/${id}`} className="text-xs text-zinc-400 hover:text-zinc-700">
          ← {store.name}
        </Link>
        <div className="mt-2">
          <PageHeader
            kicker={`Production · Ads · ${store.niche}`}
            title={
              <>
                Ads de <em className="italic text-zinc-500">{store.name}</em>
              </>
            }
            lede="Hooks fan-out (Meta / TikTok / Google), copilot conversationnel pour itérer, et bouton « Pousser » vers les gestionnaires de pub. Les performances remontent automatiquement via UTM."
          />
        </div>
      </div>

      {/* Performance — top section if any campaigns exist. */}
      <SectionCard kicker="Performance" title="Campagnes poussées">
        {performance.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Aucune campagne poussée. Génère des créas en bas, puis pousse-les vers Meta ou TikTok via le
            bouton « Pousser » dans le panneau de droite.
          </p>
        ) : (
          <PerformanceTable rows={performance} />
        )}
      </SectionCard>

      {/* Ads copilot + variants sidebar. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <AdsChat
          storeId={id}
          storeSlug={store.slug}
          metaConfigured={metaConfigured}
          tiktokConfigured={tiktokConfigured}
          initialSessions={sessionsRes.rows}
          initialSessionId={activeSessionId}
          initialMessages={initialMessages}
          initialVariants={chatVariants}
        />
      </div>

      {sharedVisuals.length > 0 && (
        <section className="border border-zinc-200 bg-white rounded-xl overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-zinc-200/70">
            <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">Visuels disponibles</p>
            <h3 className="mt-1 text-base font-serif text-zinc-900">Assets store</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
            {sharedVisuals.map((v) => (
              <a
                key={v.url}
                href={v.url}
                target="_blank"
                rel="noreferrer"
                className="block border border-zinc-200 rounded-lg overflow-hidden hover:border-zinc-400 transition-colors"
              >
                {v.kind === 'video' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <video src={v.url} muted playsInline className="w-full aspect-square object-cover bg-black" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.url} alt={v.label} className="w-full aspect-square object-cover bg-zinc-100" />
                )}
                <div className="px-2 py-1.5 text-kicker uppercase tracking-cta text-zinc-500 font-medium">
                  {v.label}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {products.length === 0 ? (
        <div className="border border-dashed border-zinc-200 rounded-xl px-6 py-16 text-center bg-white">
          <p className="text-sm font-serif text-zinc-600">Aucun produit dans ce store.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {products.map((p) => {
            const productVariants = byProduct.get(p.id) ?? [];
            const latestBatch = productVariants[0]?.batchId;
            const latest = productVariants.filter((v) => v.batchId === latestBatch);

            return (
              <article key={p.id} className="border border-zinc-200 bg-white rounded-xl overflow-hidden">
                <div className="px-6 pt-5 pb-4 border-b border-zinc-200/70 flex items-start gap-4">
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.enriched_title}
                      className="w-14 h-14 rounded-lg object-cover bg-zinc-100 shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-zinc-900 line-clamp-1">{p.enriched_title}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 tabular-nums">
                      {(p.price_cents / 100).toFixed(2)} €
                    </p>
                  </div>
                  <GenerateAdsButton storeId={id} productId={p.id} hasExisting={latest.length > 0} />
                </div>

                {latest.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-100">
                    {(['meta', 'tiktok', 'google'] as const).map((channel) => {
                      const v = latest.find((x) => x.channel === channel);
                      return (
                        <div key={channel} className="bg-white p-5 min-h-[160px]">
                          <div className="flex items-center justify-between mb-3">
                            <StatusPill tone={v ? 'emerald' : 'zinc'}>{channel}</StatusPill>
                            {v && (
                              <span className="text-kicker text-zinc-300 font-mono">
                                {new Date(v.createdAt).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                            )}
                          </div>
                          {v ? (
                            <div className="space-y-2.5 text-sm">
                              <div>
                                <p className="text-kicker uppercase tracking-cta text-zinc-400 font-medium mb-0.5">
                                  Headline
                                </p>
                                <p className="font-medium text-zinc-900 leading-snug">{v.headline}</p>
                              </div>
                              <div>
                                <p className="text-kicker uppercase tracking-cta text-zinc-400 font-medium mb-0.5">
                                  Primary
                                </p>
                                <p className="text-zinc-700 leading-snug">{v.primaryText}</p>
                              </div>
                              {v.description && (
                                <div>
                                  <p className="text-kicker uppercase tracking-cta text-zinc-400 font-medium mb-0.5">
                                    Description
                                  </p>
                                  <p className="text-zinc-600 text-xs">{v.description}</p>
                                </div>
                              )}
                              {v.cta && (
                                <div className="pt-1">
                                  <span className="inline-block text-xs bg-zinc-900 text-white px-2 py-0.5 rounded font-medium">
                                    {v.cta}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-400 italic">non généré</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center bg-zinc-50/50">
                    <p className="text-xs text-zinc-500 mb-3">Aucune variante générée.</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PerformanceTable({ rows }: { rows: CampaignPerformanceRow[] }) {
  const fmtPct = (x: number) => `${(x * 100).toFixed(2)} %`;
  const fmtEur = (cents: number) => `${(cents / 100).toFixed(2)} €`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-kicker uppercase tracking-cta text-zinc-400 font-medium">
            <th className="text-left pb-3 font-medium">Hook</th>
            <th className="text-left pb-3 font-medium">Canal</th>
            <th className="text-right pb-3 font-medium">Vues</th>
            <th className="text-right pb-3 font-medium">ATC</th>
            <th className="text-right pb-3 font-medium">Ventes</th>
            <th className="text-right pb-3 font-medium">CTR</th>
            <th className="text-right pb-3 font-medium">CPA</th>
            <th className="text-right pb-3 font-medium">ROAS</th>
            <th className="text-right pb-3 font-medium">Revenu</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr key={r.campaignId}>
              <td className="py-2.5 pr-4">
                <p className="text-zinc-900 line-clamp-1">{r.hook}</p>
                <p className="text-xs text-zinc-400 font-mono">{r.externalId ?? '—'}</p>
              </td>
              <td className="py-2.5 pr-4">
                <StatusPill tone={r.status === 'live' ? 'emerald' : r.status === 'error' ? 'red' : 'zinc'}>
                  {r.channel}
                </StatusPill>
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">{r.views}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">{r.atcs}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">{r.purchases}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">{fmtPct(r.ctr)}</td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                {r.cpa > 0 ? `${r.cpa.toFixed(2)} €` : '—'}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-nums">
                {r.roas > 0 ? `${r.roas.toFixed(2)}×` : '—'}
              </td>
              <td className="py-2.5 text-right tabular-nums font-medium">{fmtEur(r.revenueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
