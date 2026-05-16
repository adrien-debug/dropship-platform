import { medusa } from '@/lib/medusa';
import { getDb } from '@/lib/db';
import * as aliexpress from '@/lib/suppliers/aliexpress';
import * as cj from '@/lib/suppliers/cj';
import { filterByImageQuality, type ImageQualityVerdict } from './image-quality';
import { generateMonoAssets } from './asset-generator';
import { writeLandingContent } from './landing-writer';
import { extractJson } from './json';
import { trackedKimiMessage } from './kimi';
import { runContext } from './run-context';
import { rankAndKeepTop } from './product-scorer';
import { buildMedusaHandle, slugifyTitle } from './handle';
import { buildPaletteFromPreset, getPreset } from '@/lib/design/presets';

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
  /**
   * Design system locked at creation. The chat picker writes these three
   * fields once and they become the source of truth — every storefront
   * component reads from `dropship_stores.design_preset` + `.palette`
   * instead of inventing colors or fonts on each render.
   */
  designPreset?:
    | 'editorial-serif'
    | 'tech-mono'
    | 'brutalist-luxe'
    | 'gen-z-bold'
    | 'lifestyle-warm';
  primaryColor?: string;
  accentColor?: string;
  /** Storefront template id chosen by the operator (or suggested by the
   *  research-copilot). When the template is in the `luxury` register, the
   *  asset generator + landing writer switch to luxury voice instead of the
   *  standard DTC defaults. Defaults to `'auto'` if absent. */
  template?: string;
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
  // Optional supplier signals used by the deterministic product scorer
  // (P0.5). Populated from AE search response when available. Missing for
  // CJ (the v1 client doesn't expose these), which is fine — scorer
  // treats them as neutral.
  orders?: number;
  evaluateRate?: string;
};

// Slug helper kept local for store-name slugs; product handles go through
// buildMedusaHandle so the Google Merchant feed and the import path share
// the same convention.
const slugify = slugifyTitle;

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
      const ordersParsed = parseInt(p.thirty_days_sold_count || '0', 10);
      results.push({
        supplier: 'aliexpress',
        externalId: p.product_id,
        title: p.product_title,
        price: parseFloat(p.sale_price || p.original_price || '0'),
        imageUrl: p.product_main_image_url,
        supplierUrl: p.product_url,
        orders: Number.isFinite(ordersParsed) ? ordersParsed : undefined,
        evaluateRate: p.evaluate_rate || undefined,
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

  const { text } = await trackedKimiMessage({ step: 'generate-products' }, [
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
    "primaryColor": "#hex dark/saturated color for header/footer",
    "secondaryColor": "#hex very light tint of primaryColor for backgrounds (NOT a random color — must be the SAME HUE as primary, just very light)",
    "accentColor": "#hex vibrant color for CTAs (MUST be ANALOGOUS to primaryColor — same hue family or one step on the color wheel. NEVER a complementary clash like green+pink, blue+orange, purple+yellow. Aim for primary=dark teal → accent=warmer teal/turquoise, NOT primary=dark green → accent=hot pink.)",
    "logoEmoji": "one emoji that fits the niche"
  }
}

Hard color rule: the three colors must form a coherent palette. If you cannot guarantee that, default to a monochromatic palette built from one hue (e.g. primary=#1F3D2C dark, secondary=#EAF2EC light, accent=#2E7D5C mid). Random complementary stunts ruin the storefront.`,
    },
  ]);

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

  const { text } = await trackedKimiMessage({ step: 'enrich-products' }, [
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
    "primaryColor": "#hex dark/saturated",
    "secondaryColor": "#hex very light tint of the SAME hue as primaryColor",
    "accentColor": "#hex vibrant but ANALOGOUS to primaryColor (same hue family, never a complementary clash like green+pink, blue+orange, purple+yellow). Prefer monochromatic. Random complementary stunts ruin the storefront.",
    "logoEmoji": "emoji"
  }
}`,
    },
  ]);

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

      // Insert with the chosen template right away — landing-writer + asset
      // generator both read `template` from the row to decide whether to use
      // the luxury voice / luxury prompts. Defaults to 'auto' (legacy mode).
      const insertRes = await db.query<{ id: string }>(
        `INSERT INTO dropship_stores (slug, name, niche, mode, status, template) VALUES ($1, $2, $3, $4, 'creating', $5) RETURNING id`,
        [slug, input.storeName, input.niche, mode, input.template ?? 'auto'],
      );
      const storeId = insertRes.rows[0]!.id;

      // From here on every Anthropic call landed via trackedMessage will
      // pick up storeId automatically (AsyncLocalStorage in run-context).
      await runContext.run({ storeId }, async () => {

      emit({ type: 'step', message: 'Recherche produits chez AliExpress & CJ Dropshipping...' });

      const rawProducts = await searchSuppliers(input.niche, 25, emit);

      // ── P0.5 Deterministic pre-vision scorer ────────────────────────
      // Before paying Haiku Vision $0.001/image to score every supplier
      // result, rank with a pure formula (cost / orders / rating / margin
      // / image-presence) and keep top 25. Cuts the vision token bill
      // ~50% and stops asking the model to look at obvious junk.
      const PRE_VISION_TOP_N = 25;
      const initialCount = rawProducts.length;
      if (initialCount > PRE_VISION_TOP_N) {
        const ranked = rankAndKeepTop(rawProducts, PRE_VISION_TOP_N);
        // Decorated items keep all original RawProduct fields + _score +
        // _scoreReasons. We strip the underscore fields when re-assigning
        // so the rest of the pipeline sees the same shape, but we log
        // a debug breakdown via the SSE event.
        const topScore = ranked[0]?._score ?? 0;
        const bottomScore = ranked[ranked.length - 1]?._score ?? 0;
        rawProducts.length = 0;
        rawProducts.push(...ranked.map(({ _score: _s, _scoreReasons: _r, ...p }) => p));
        emit({
          type: 'step',
          message: `${ranked.length} candidats retenus par score (top ${PRE_VISION_TOP_N} sur ${initialCount})`,
          data: { kept: ranked.length, total: initialCount, topScore, bottomScore },
        });
      }

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

      // Operator-locked palette: if the chat picker confirmed colors, those
      // OVERRIDE whatever Claude generated during enrichment. The whole point
      // of the picker is that the operator decides once and nothing else
      // gets to change them.
      if (input.primaryColor) branding.primaryColor = input.primaryColor;
      if (input.accentColor) branding.accentColor = input.accentColor;

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

      const IMPORT_CONCURRENCY = 4;

      let imported = 0;
      const importOne = async (ep: EnrichedProduct) => {
        try {
          const handle = buildMedusaHandle({
            title: ep.enrichedTitle,
            externalId: ep.externalId,
            storeId,
          });
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

      // Locked design system: the picker passed (or defaulted) a preset slug.
      // Resolve it to a curated preset and freeze the palette in DB so every
      // storefront component reads the same source of truth from now on.
      const presetSlug = input.designPreset ?? 'editorial-serif';
      const preset = getPreset(presetSlug);
      const palette = buildPaletteFromPreset(
        preset,
        branding.primaryColor,
        branding.accentColor,
      );

      // Mono stores can't go 'active' until hero asset generation succeeds;
      // collection stores have no asset pipeline, so they activate here.
      const activateNow = mode !== 'mono';
      await db.query(
        `UPDATE dropship_stores SET
           ${activateNow ? "status = 'active', " : ''}tagline = $1, description = $2,
           primary_color = $3, secondary_color = $4, accent_color = $5,
           logo_emoji = $6, medusa_sales_channel_id = $7,
           medusa_publishable_key = $8, product_count = $9,
           design_preset = $10, palette = $11, updated_at = now()
         WHERE id = $12`,
        [
          branding.tagline, branding.description,
          branding.primaryColor, branding.secondaryColor, branding.accentColor,
          branding.logoEmoji, channel.id, apiKey.token, imported,
          preset.slug, JSON.stringify(palette), storeId,
        ],
      );

      // Structured landing copy. We run this AFTER the store is marked
      // active so the storefront is already browseable; templates fall
      // back to generic strings until landing_content is filled in.
      // Failure here is non-fatal — the store still works.
      if (enriched[0]) {
        emit({ type: 'step', message: 'Rédaction de la landing...' });
        const heroProduct = enriched[0];
        try {
          const landing = await writeLandingContent({
            storeName: input.storeName,
            niche: input.niche,
            tagline: branding.tagline,
            storeDescription: branding.description,
            productTitle: heroProduct.enrichedTitle,
            productDescription: heroProduct.enrichedDescription,
            mode,
            template: input.template,
            accentColor: palette.accent,
            supplierCostCents: heroProduct.costCents,
          });
          await db.query(
            `UPDATE dropship_stores SET landing_content = $1 WHERE id = $2`,
            [JSON.stringify(landing), storeId],
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'erreur inconnue';
          emit({ type: 'progress', message: `⚠ Landing writer: ${msg}` });
        }
      }

      // Mono mode: kick off the asset generation pipeline. The store stays
      // 'creating' until hero generation succeeds — we never expose a live
      // storefront with an empty hero. Retry up to 3× with exponential backoff.
      if (mode === 'mono' && enriched[0]) {
        const heroProduct = enriched[0];
        emit({ type: 'step', message: 'Génération des visuels (hero, lifestyles, vidéo)...' });
        await db.query(
          `UPDATE dropship_stores SET assets_status = 'generating' WHERE id = $1`,
          [storeId],
        );

        const MAX_ASSET_RETRIES = 3;
        let assets: Awaited<ReturnType<typeof generateMonoAssets>> | null = null;
        let lastAssetError: string | null = null;

        for (let attempt = 1; attempt <= MAX_ASSET_RETRIES; attempt++) {
          try {
            if (attempt > 1) {
              const delay = (attempt - 1) * 8000;
              emit({ type: 'progress', message: `⏳ Retry génération assets (${attempt}/${MAX_ASSET_RETRIES})…` });
              await new Promise((r) => setTimeout(r, delay));
            }
            assets = await generateMonoAssets(
              {
                storeId,
                storeSlug: slug,
                product: {
                  title: heroProduct.enrichedTitle,
                  description: heroProduct.enrichedDescription,
                  imageUrl: heroProduct.imageUrl,
                },
                niche: input.niche,
                template: input.template,
                accentColor: palette.accent,
                storeName: input.storeName,
                language,
                skipVideo: input.skipVideo,
                design: {
                  presetSlug: preset.slug,
                  imageryMood: preset.imageryMood,
                  primaryColor: palette.primary,
                  accentColor: palette.accent,
                },
              },
              (msg) => emit({ type: 'progress', message: msg }),
            );
            if (assets.heroUrl) break;
            lastAssetError = 'heroUrl manquant après génération';
            emit({ type: 'progress', message: `⚠ Asset generation tentative ${attempt}: ${lastAssetError}` });
          } catch (e) {
            lastAssetError = e instanceof Error ? e.message : 'erreur inconnue';
            emit({ type: 'progress', message: `⚠ Asset generation tentative ${attempt}: ${lastAssetError}` });
          }
        }

        const hasHero = Boolean(assets?.heroUrl);

        await db.query(
          `UPDATE dropship_stores SET
             assets_run_id = $1, hero_image_url = $2, cutout_image_url = $3,
             lifestyle_images = $4, promo_video_url = $5,
             assets_status = $6, updated_at = now()
           WHERE id = $7`,
          [
            assets?.runId ?? null,
            assets?.heroUrl ?? null,
            assets?.cutoutUrl ?? null,
            JSON.stringify(assets?.lifestyleUrls ?? []),
            assets?.promoVideoUrl ?? null,
            hasHero ? 'ready' : 'error',
            storeId,
          ],
        );

        for (const w of assets?.warnings ?? []) {
          emit({ type: 'progress', message: `⚠ ${w}` });
        }

        if (hasHero) {
          await db.query(
            `UPDATE dropship_stores SET status = 'active', updated_at = now() WHERE id = $1`,
            [storeId],
          );
        } else {
          // Assets failed (fal/Comfy/Anthropic down). Activate the store
          // anyway — the storefront falls back to the supplier images and
          // the operator can re-trigger asset generation later via the admin
          // regenerator. Persisting `creating` would make the storefront 404
          // permanently which is a worse outcome than imperfect visuals.
          const errMsg = assets?.errors[0] || lastAssetError || 'Génération des assets échouée';
          await db.query(
            `UPDATE dropship_stores SET status = 'active', error_message = $1, updated_at = now() WHERE id = $2`,
            [errMsg, storeId],
          );
          emit({ type: 'progress', message: `⚠ Assets non générés après ${MAX_ASSET_RETRIES} tentatives: ${errMsg}. Boutique activée avec photos supplier.` });
        }
      }

      emit({
        type: 'success',
        message: `✅ "${input.storeName}" créé avec ${imported} produit${imported > 1 ? 's' : ''} !`,
        data: { storeId, slug, storeName: input.storeName, productCount: imported, mode, url: `/shop/${slug}` },
      });
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
