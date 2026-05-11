import Anthropic from '@anthropic-ai/sdk';
import { medusa } from '@/lib/medusa';
import { getDb } from '@/lib/db';
import * as aliexpress from '@/lib/suppliers/aliexpress';
import * as cj from '@/lib/suppliers/cj';
import { filterByImageQuality, type ImageQualityVerdict } from './image-quality';
import { generateMonoAssets } from './asset-generator';
import { extractJson } from './json';

export interface StoreCreationInput {
  niche: string;
  storeName: string;
  maxProducts?: number;
  language?: 'fr' | 'en';
  /**
   * mono = single hero SKU + auto-generated hero/lifestyle/video assets.
   * collection = 3-25 SKUs catalogue, no asset generation (current behaviour).
   */
  mode?: 'mono' | 'collection';
  /** Skip the 5s promo video (faster + cheaper). Only relevant when mode='mono'. */
  skipVideo?: boolean;
}

export interface AgentEvent {
  type: 'step' | 'progress' | 'success' | 'error' | 'done';
  message: string;
  data?: Record<string, unknown>;
}

interface EnrichedProduct {
  originalTitle: string;
  enrichedTitle: string;
  enrichedDescription: string;
  priceCents: number;
  costCents: number;
  imageUrl: string;
  supplierUrl: string;
  supplier: 'aliexpress' | 'cj' | 'ai-generated';
  externalId: string;
}

interface BrandingResult {
  tagline: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoEmoji: string;
}

type RawProduct = {
  supplier: 'aliexpress' | 'cj';
  externalId: string;
  title: string;
  price: number;
  imageUrl: string;
  supplierUrl: string;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function searchSuppliers(
  niche: string,
  maxPerSupplier: number,
  emit: (e: AgentEvent) => void,
): Promise<RawProduct[]> {
  const results: RawProduct[] = [];
  let aliCount = 0;
  let cjCount = 0;

  const [aliRes, cjRes] = await Promise.allSettled([
    aliexpress.searchProducts({
      keywords: niche,
      pageSize: maxPerSupplier,
      currency: 'EUR',
      countryCode: 'FR',
      locale: 'fr_FR',
    }),
    cj.searchProducts({ keywords: niche, pageSize: maxPerSupplier }),
  ]);

  if (aliRes.status === 'fulfilled' && aliRes.value.success && aliRes.value.data) {
    for (const p of aliRes.value.data.products) {
      results.push({
        supplier: 'aliexpress',
        externalId: p.product_id,
        title: p.product_title,
        price: parseFloat(p.sale_price || p.original_price || '0'),
        imageUrl: p.product_main_image_url,
        supplierUrl: p.product_url,
      });
    }
    aliCount = aliRes.value.data.products.length;
  }

  if (cjRes.status === 'fulfilled' && cjRes.value.success && cjRes.value.data) {
    for (const p of cjRes.value.data.list) {
      results.push({
        supplier: 'cj',
        externalId: p.pid,
        title: p.productNameEn,
        price: p.sellPrice,
        imageUrl: p.productImage,
        supplierUrl: p.sellUrl || '',
      });
    }
    cjCount = cjRes.value.data.list.length;
  }

  if (aliCount > 0 || cjCount > 0) {
    emit({
      type: 'progress',
      message: `${aliCount} produits AliExpress + ${cjCount} produits CJ trouvés`,
      data: { aliCount, cjCount, total: results.length },
    });
  }

  return results;
}

// Called when supplier APIs have no results — Claude generates product concepts
async function generateProductsWithClaude(
  niche: string,
  storeName: string,
  maxProducts: number,
  language: 'fr' | 'en',
  emit: (e: AgentEvent) => void,
): Promise<{ products: EnrichedProduct[]; branding: BrandingResult }> {
  emit({ type: 'step', message: `APIs fournisseurs indisponibles — génération IA des produits pour "${niche}"...` });

  const langInstruction = language === 'fr'
    ? 'Write ALL content in French (titles, descriptions).'
    : 'Write ALL content in English.';

  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a dropshipping expert. Create a complete product catalog for a dropshipping store.

Store name: "${storeName}"
Niche: "${niche}"
Number of products needed: ${maxProducts}
${langInstruction}

Generate ${maxProducts} realistic dropshipping products for this niche. These should be products typically found on AliExpress or CJ Dropshipping.

Return ONLY valid JSON:
{
  "products": [
    {
      "id": "ai-001",
      "originalTitle": "Raw product name as it would appear from supplier",
      "enrichedTitle": "Compelling retail title (max 65 chars)",
      "enrichedDescription": "Benefit-focused description (130-170 words). Include key features, materials, use cases, and why customers love it.",
      "costCents": <supplier cost in euro cents, realistic for AliExpress pricing>,
      "retailPriceCents": <retail price = cost * 2.2 rounded to nearest .99, min 999>,
      "imageUrl": "",
      "supplierUrl": ""
    }
  ],
  "branding": {
    "tagline": "Short punchy tagline (max 60 chars)",
    "description": "Store description (40-60 words)",
    "primaryColor": "#hex dark color for header/footer",
    "secondaryColor": "#hex light color for background",
    "accentColor": "#hex vibrant color for buttons/prices",
    "logoEmoji": "one emoji that fits the niche"
  }
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = extractJson<{
    products: Array<{
      id: string;
      originalTitle: string;
      enrichedTitle: string;
      enrichedDescription: string;
      costCents: number;
      retailPriceCents: number;
      imageUrl: string;
      supplierUrl: string;
    }>;
    branding: BrandingResult;
  }>(text);
  if (!parsed) throw new Error('Claude returned invalid JSON for product generation');

  if (!parsed.products?.length || !parsed.branding) {
    throw new Error(`Claude returned incomplete payload (products=${parsed.products?.length ?? 0}, branding=${!!parsed.branding})`);
  }

  emit({
    type: 'progress',
    message: `✨ ${parsed.products.length} produits générés par Claude AI`,
    data: { count: parsed.products.length, source: 'ai-generated' },
  });

  const products: EnrichedProduct[] = parsed.products.map(p => ({
    originalTitle: p.originalTitle,
    enrichedTitle: p.enrichedTitle,
    enrichedDescription: p.enrichedDescription,
    priceCents: p.retailPriceCents,
    costCents: p.costCents,
    imageUrl: p.imageUrl || '',
    supplierUrl: p.supplierUrl || '',
    supplier: 'ai-generated' as const,
    externalId: p.id,
  }));

  return { products, branding: parsed.branding };
}

async function enrichSupplierProductsWithClaude(
  niche: string,
  storeName: string,
  rawProducts: RawProduct[],
  maxProducts: number,
  language: 'fr' | 'en',
  emit: (e: AgentEvent) => void,
): Promise<{ products: EnrichedProduct[]; branding: BrandingResult }> {
  const anthropic = getAnthropicClient();
  const langInstruction = language === 'fr'
    ? 'Write all content in French.'
    : 'Write all content in English.';

  emit({ type: 'step', message: 'Enrichissement IA en cours (Claude)...' });

  const productsJson = JSON.stringify(
    rawProducts.slice(0, 40).map((p, i) => ({
      index: i,
      supplier: p.supplier,
      id: p.externalId,
      title: p.title,
      cost_eur: p.price,
      has_image: !!p.imageUrl,
    })),
    null,
    2,
  );

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert dropshipping product specialist and copywriter.

Store name: "${storeName}"
Niche: "${niche}"
${langInstruction}

Raw supplier products:
${productsJson}

Tasks:
1. Select the best ${maxProducts} products most relevant to the niche.
2. Write a compelling title (max 65 chars) and description (130-170 words) for each.
3. Retail price = cost * 2.2 rounded to nearest .99, minimum €9.99.
4. Generate store branding.

Return ONLY valid JSON:
{
  "products": [
    {
      "index": <original index number>,
      "enrichedTitle": "...",
      "enrichedDescription": "...",
      "retailPriceCents": <integer>,
      "costCents": <integer from cost_eur * 100>
    }
  ],
  "branding": {
    "tagline": "...",
    "description": "...",
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "logoEmoji": "emoji"
  }
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = extractJson<{
    products: Array<{
      index: number;
      enrichedTitle: string;
      enrichedDescription: string;
      retailPriceCents: number;
      costCents: number;
    }>;
    branding: BrandingResult;
  }>(text);
  if (!parsed) throw new Error('Claude returned invalid JSON');

  const enriched: EnrichedProduct[] = parsed.products.map(ep => {
    const raw = rawProducts[ep.index];
    return {
      originalTitle: raw.title,
      enrichedTitle: ep.enrichedTitle,
      enrichedDescription: ep.enrichedDescription,
      priceCents: ep.retailPriceCents,
      costCents: ep.costCents,
      imageUrl: raw.imageUrl,
      supplierUrl: raw.supplierUrl,
      supplier: raw.supplier,
      externalId: raw.externalId,
    };
  });

  emit({
    type: 'progress',
    message: `${enriched.length} produits enrichis par Claude`,
    data: { count: enriched.length },
  });

  return { products: enriched, branding: parsed.branding };
}

// Deterministic product image using picsum with a seed derived from the title
function fetchProductImage(query: string): string {
  const seed = query
    .toLowerCase()
    .split('')
    .reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 7);
  return `https://picsum.photos/seed/${seed}/600/600`;
}

export async function* createStore(input: StoreCreationInput): AsyncGenerator<AgentEvent> {
  const events: AgentEvent[] = [];
  let resolveNext: ((v: { value: AgentEvent; done: false }) => void) | null = null;
  let done = false;

  const emit = (e: AgentEvent) => {
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r({ value: e, done: false });
    } else {
      events.push(e);
    }
  };

  const mode = input.mode ?? 'collection';
  // Mono mode is locked to a single SKU regardless of maxProducts. Collection
  // mode uses the requested count (default 12).
  const maxProducts = mode === 'mono' ? 1 : input.maxProducts ?? 12;
  const language = input.language ?? 'fr';

  const run = async () => {
    const db = getDb();
    const slug = slugify(input.storeName) + '-' + Date.now().toString(36);

    try {
      emit({ type: 'step', message: `Démarrage de l'agent pour "${input.storeName}" (niche: ${input.niche})` });

      const insertRes = await db.query<{ id: string }>(
        `INSERT INTO dropship_stores (slug, name, niche, mode, status) VALUES ($1, $2, $3, $4, 'creating') RETURNING id`,
        [slug, input.storeName, input.niche, mode],
      );
      const storeId = insertRes.rows[0]!.id;

      emit({ type: 'step', message: 'Recherche produits chez AliExpress & CJ Dropshipping...' });

      const rawProducts = await searchSuppliers(input.niche, 25, emit);

      // Vision filter: rejects supplier images with text overlays, prices,
      // discount badges, watermarks, collages, human models. Mandatory for
      // mono (the hero IS the brand) — for collection we still rank but don't
      // fail the run if everything fails.
      const visionVerdicts = new Map<string, ImageQualityVerdict>();
      if (rawProducts.length > 0) {
        emit({
          type: 'step',
          message: `Filtre vision Claude — analyse de ${rawProducts.length} images produit...`,
        });
        const { kept, rejected } = await filterByImageQuality(
          rawProducts.map((p) => ({ ...p, imageUrl: p.imageUrl })),
          mode === 'mono' ? 0.65 : 0.5,
        );
        kept.forEach((p) => visionVerdicts.set(p.externalId, p._quality));
        rejected.forEach((p) => visionVerdicts.set(p.externalId, p._quality));

        emit({
          type: 'progress',
          message: `${kept.length} produits qualifiés · ${rejected.length} rejetés (écritures/prix/badges)`,
          data: { kept: kept.length, rejected: rejected.length },
        });

        // Replace rawProducts with kept (sorted by score desc); fall back to
        // unfiltered if vision rejected everything (no supplier match is a
        // worse outcome than a slightly-noisy image).
        if (kept.length > 0) {
          rawProducts.length = 0;
          rawProducts.push(...kept.map(({ _quality: _q, ...p }) => p));
        } else {
          emit({
            type: 'progress',
            message: '⚠ Aucune image n’a passé le filtre — on continue avec les meilleures malgré tout',
          });
        }
      }

      let enriched: EnrichedProduct[];
      let branding: BrandingResult;

      if (rawProducts.length === 0) {
        // Fallback: let Claude generate the whole catalog
        emit({ type: 'progress', message: 'APIs fournisseurs non disponibles — passage en mode génération IA pure.' });

        const aiResult = await generateProductsWithClaude(input.niche, input.storeName, maxProducts, language, emit);

        emit({ type: 'step', message: 'Attribution des visuels produits...' });
        for (const p of aiResult.products) {
          if (!p.imageUrl) {
            p.imageUrl = fetchProductImage(p.enrichedTitle);
          }
        }

        enriched = aiResult.products;
        branding = aiResult.branding;
      } else {
        // Enrich real supplier products
        const result = await enrichSupplierProductsWithClaude(
          input.niche, input.storeName, rawProducts, maxProducts, language, emit,
        );
        enriched = result.products;
        branding = result.branding;
      }

      emit({ type: 'step', message: 'Création du canal de vente Medusa...' });
      const channel = await medusa.createSalesChannel(
        input.storeName,
        `Store dropshipping — ${input.niche}`,
      );

      emit({ type: 'step', message: 'Création de la clé API publique...' });
      let apiKey: { id: string; token: string };
      try {
        apiKey = await medusa.createPublishableApiKey(`${input.storeName} Store Key`);
        await medusa.addSalesChannelsToPublishableKey(apiKey.id, [channel.id]);

        // Without this link, Medusa /store/shipping-options returns 0 options
        // for any cart on this sales_channel — checkout would dead-end at "no
        // shipping option available". We use the first stock_location (a
        // single warehouse setup is the assumption for this MVP).
        const stockLocations = await medusa.listStockLocations();
        if (stockLocations[0]) {
          await medusa.linkSalesChannelsToStockLocation(stockLocations[0].id, [channel.id]);
        } else {
          console.warn('[store-creator] no stock_location to link new sales channel to', { channelId: channel.id });
        }
      } catch (e) {
        console.error('[store-creator] publishable key / stock-location setup failed, rolling back', {
          channelId: channel.id,
          error: e instanceof Error ? e.message : String(e),
        });
        await medusa.deleteSalesChannel(channel.id).catch(() => {});
        throw e;
      }

      emit({ type: 'step', message: `Import de ${enriched.length} produits dans Medusa...` });

      const storeHandleSuffix = storeId.replace(/-/g, '').slice(0, 6);
      const IMPORT_CONCURRENCY = 4;

      let imported = 0;
      const importOne = async (ep: EnrichedProduct) => {
        try {
          const handle = `${slugify(ep.enrichedTitle)}-${ep.externalId.slice(0, 8).replace(/[^a-z0-9]/gi, '')}-${storeHandleSuffix}`;
          const medusaProduct = await medusa.createProductWithChannel(
            {
              title: ep.enrichedTitle,
              description: ep.enrichedDescription,
              handle,
              status: 'published',
              thumbnail: ep.imageUrl || undefined,
              images: ep.imageUrl ? [ep.imageUrl] : [],
              options: [{ title: 'Default', values: ['Standard'] }],
              variants: [
                {
                  title: 'Standard',
                  // Medusa v2 stores money in major units (EUR with decimals),
                  // not minor units. The payment-stripe module converts to
                  // Stripe's smallest unit by multiplying by 100, so passing
                  // cents here makes Stripe see 100× the real total.
                  prices: [{ currency_code: 'eur', amount: ep.priceCents / 100 }],
                  inventory_quantity: 999,
                },
              ],
              metadata: {
                supplier: ep.supplier,
                external_id: ep.externalId,
                cost_cents: ep.costCents,
                store_id: storeId,
              },
            },
            channel.id,
          );

          const verdict = visionVerdicts.get(ep.externalId);
          await db.query(
            `INSERT INTO dropship_store_products
               (store_id, medusa_product_id, supplier, external_id,
                original_title, enriched_title, enriched_description,
                price_cents, cost_cents, image_url, supplier_url,
                image_quality_score, image_quality_issues)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT (store_id, supplier, external_id) DO NOTHING`,
            [
              storeId, medusaProduct.id, ep.supplier, ep.externalId,
              ep.originalTitle, ep.enrichedTitle, ep.enrichedDescription,
              ep.priceCents, ep.costCents, ep.imageUrl || null, ep.supplierUrl || null,
              verdict?.score ?? null, JSON.stringify(verdict?.issues ?? []),
            ],
          );

          imported++;
          emit({
            type: 'progress',
            message: `(${imported}/${enriched.length}) ${ep.enrichedTitle}`,
            data: { imported, total: enriched.length },
          });
        } catch (err) {
          emit({
            type: 'progress',
            message: `⚠ Ignoré: ${ep.enrichedTitle} — ${err instanceof Error ? err.message : 'erreur'}`,
          });
        }
      };

      for (let i = 0; i < enriched.length; i += IMPORT_CONCURRENCY) {
        await Promise.all(enriched.slice(i, i + IMPORT_CONCURRENCY).map(importOne));
      }

      await db.query(
        `UPDATE dropship_stores SET
           status = 'active', tagline = $1, description = $2,
           primary_color = $3, secondary_color = $4, accent_color = $5,
           logo_emoji = $6, medusa_sales_channel_id = $7,
           medusa_publishable_key = $8, product_count = $9, updated_at = now()
         WHERE id = $10`,
        [
          branding.tagline, branding.description,
          branding.primaryColor, branding.secondaryColor, branding.accentColor,
          branding.logoEmoji, channel.id, apiKey.token, imported, storeId,
        ],
      );

      // Mono mode: kick off the asset generation pipeline. We do this AFTER
      // the store row is marked 'active' so the storefront is already
      // browseable while images render. Failures here are non-fatal — the
      // store still works with the supplier image.
      if (mode === 'mono' && enriched[0]) {
        const heroProduct = enriched[0];
        emit({ type: 'step', message: 'Génération des visuels (hero, lifestyles, vidéo)...' });
        await db.query(
          `UPDATE dropship_stores SET assets_status = 'generating' WHERE id = $1`,
          [storeId],
        );
        try {
          const assets = await generateMonoAssets(
            {
              storeSlug: slug,
              product: {
                title: heroProduct.enrichedTitle,
                description: heroProduct.enrichedDescription,
                imageUrl: heroProduct.imageUrl,
              },
              niche: input.niche,
              language,
              skipVideo: input.skipVideo,
            },
            (msg) => emit({ type: 'progress', message: msg }),
          );

          const hasAnyAsset = Boolean(assets.heroUrl || assets.cutoutUrl || assets.lifestyleUrls.length);
          await db.query(
            `UPDATE dropship_stores SET
               assets_run_id = $1,
               hero_image_url = $2,
               cutout_image_url = $3,
               lifestyle_images = $4,
               promo_video_url = $5,
               assets_status = $6,
               updated_at = now()
             WHERE id = $7`,
            [
              assets.runId || null,
              assets.heroUrl,
              assets.cutoutUrl,
              JSON.stringify(assets.lifestyleUrls),
              assets.promoVideoUrl,
              hasAnyAsset ? 'ready' : 'error',
              storeId,
            ],
          );

          for (const w of assets.warnings) {
            emit({ type: 'progress', message: `⚠ ${w}` });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'erreur inconnue';
          emit({ type: 'progress', message: `⚠ Asset generation: ${msg}` });
          await db.query(
            `UPDATE dropship_stores SET assets_status = 'error' WHERE id = $1`,
            [storeId],
          );
        }
      }

      emit({
        type: 'success',
        message: `✅ "${input.storeName}" créé avec ${imported} produit${imported > 1 ? 's' : ''} !`,
        data: { storeId, slug, storeName: input.storeName, productCount: imported, mode, url: `/shop/${slug}` },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      await db.query(
        `UPDATE dropship_stores SET status='error', error_message=$1, updated_at=now() WHERE slug=$2`,
        [msg, slug],
      ).catch(() => {});
      emit({ type: 'error', message: msg });
    }

    done = true;
    emit({ type: 'done', message: 'Agent terminé' });
  };

  run();

  while (true) {
    if (events.length > 0) {
      yield events.shift()!;
    } else if (done) {
      return;
    } else {
      await new Promise<void>(resolve => {
        if (events.length > 0) return resolve();
        resolveNext = (result) => {
          events.push(result.value);
          resolve();
        };
      });
    }
  }
}
