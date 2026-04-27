import Anthropic from '@anthropic-ai/sdk';
import { medusa } from '@/lib/medusa';
import { getDb } from '@/lib/db';
import * as aliexpress from '@/lib/suppliers/aliexpress';
import * as cj from '@/lib/suppliers/cj';

export interface StoreCreationInput {
  niche: string;
  storeName: string;
  maxProducts?: number;
  language?: 'fr' | 'en';
}

export interface AgentEvent {
  type: 'step' | 'progress' | 'success' | 'error' | 'done';
  message: string;
  data?: Record<string, unknown>;
}

export interface CreatedStore {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  medusaSalesChannelId: string;
  medusaPublishableKey: string;
}

interface EnrichedProduct {
  originalTitle: string;
  enrichedTitle: string;
  enrichedDescription: string;
  priceCents: number;
  costCents: number;
  imageUrl: string;
  supplierUrl: string;
  supplier: 'aliexpress' | 'cj';
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

type RawProduct = {
  supplier: 'aliexpress' | 'cj';
  externalId: string;
  title: string;
  price: number;
  imageUrl: string;
  supplierUrl: string;
};

async function searchAllSuppliers(
  niche: string,
  maxPerSupplier: number,
  emit: (e: AgentEvent) => void,
): Promise<{ raw: RawProduct[]; aliCount: number; cjCount: number }> {

  const results: RawProduct[] = [];
  let aliCount = 0;
  let cjCount = 0;

  const [aliRes, cjRes] = await Promise.allSettled([
    aliexpress.searchProducts({ keywords: niche, pageSize: maxPerSupplier }),
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

  emit({
    type: 'progress',
    message: `${aliCount} produits AliExpress + ${cjCount} produits CJ trouvés`,
    data: { aliCount, cjCount, total: results.length },
  });

  return { raw: results, aliCount, cjCount };
}

async function enrichWithClaude(
  niche: string,
  storeName: string,
  rawProducts: Array<{
    supplier: 'aliexpress' | 'cj';
    externalId: string;
    title: string;
    price: number;
    imageUrl: string;
    supplierUrl: string;
  }>,
  maxProducts: number,
  language: 'fr' | 'en',
  emit: (e: AgentEvent) => void,
): Promise<{ products: EnrichedProduct[]; branding: BrandingResult }> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const langInstruction = language === 'fr'
    ? 'Write all content in French.'
    : 'Write all content in English.';

  const productsJson = JSON.stringify(
    rawProducts.slice(0, 40).map((p, i) => ({
      index: i,
      supplier: p.supplier,
      id: p.externalId,
      title: p.title,
      price_eur: p.price,
      has_image: !!p.imageUrl,
    })),
    null,
    2,
  );

  emit({ type: 'step', message: 'Enrichissement IA en cours (Claude)...' });

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

Here are raw supplier products:
${productsJson}

Your tasks:
1. Select the best ${maxProducts} products that are most relevant to the niche and likely to sell well. Prefer products with images and reasonable prices.
2. For each selected product, write a compelling short title (max 65 chars) and a description (120-180 words) that highlights benefits.
3. Calculate retail price: cost * 2.2 rounded to nearest .99 (minimum €9.99)
4. Generate store branding: tagline, short description, color palette, emoji logo.

Return ONLY valid JSON with this exact structure:
{
  "products": [
    {
      "index": <original index>,
      "enrichedTitle": "...",
      "enrichedDescription": "...",
      "retailPriceCents": <integer cents>,
      "costCents": <integer cents from price_eur * 100>
    }
  ],
  "branding": {
    "tagline": "...",
    "description": "...",
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "logoEmoji": "single emoji"
  }
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude returned invalid JSON');

  const parsed = JSON.parse(jsonMatch[0]) as {
    products: Array<{
      index: number;
      enrichedTitle: string;
      enrichedDescription: string;
      retailPriceCents: number;
      costCents: number;
    }>;
    branding: BrandingResult;
  };

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

export async function* createStore(
  input: StoreCreationInput,
): AsyncGenerator<AgentEvent> {
  const events: AgentEvent[] = [];
  let resolveNext: ((v: IteratorResult<AgentEvent>) => void) | null = null;
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

  const maxProducts = input.maxProducts ?? 12;
  const language = input.language ?? 'fr';

  const run = async () => {
    const db = getDb();
    const slug = slugify(input.storeName) + '-' + Date.now().toString(36);

    try {
      emit({ type: 'step', message: `Création du store "${input.storeName}" (niche: ${input.niche})` });

      // Insert store row in 'creating' state
      const insertRes = await db.query<{ id: string }>(
        `INSERT INTO dropship_stores (slug, name, niche, status)
         VALUES ($1, $2, $3, 'creating') RETURNING id`,
        [slug, input.storeName, input.niche],
      );
      const storeId = insertRes.rows[0]!.id;

      emit({ type: 'step', message: `Recherche produits chez AliExpress & CJ Dropshipping...` });

      // Search suppliers
      const { raw } = await searchAllSuppliers(input.niche, 25, emit);

      if (raw.length === 0) {
        throw new Error(`Aucun produit trouvé pour la niche "${input.niche}". Essayez un mot-clé différent.`);
      }

      // Enrich with Claude
      const { products: enriched, branding } = await enrichWithClaude(
        input.niche, input.storeName, raw, maxProducts, language, emit,
      );

      emit({ type: 'step', message: `Création du canal de vente Medusa...` });

      // Create Medusa sales channel
      const channel = await medusa.createSalesChannel(
        input.storeName,
        `Canal dropshipping pour le store ${input.storeName} (niche: ${input.niche})`,
      );

      emit({ type: 'step', message: `Création de la clé API publique Medusa...` });

      // Create publishable API key scoped to this channel
      const apiKey = await medusa.createPublishableApiKey(`${input.storeName} - Store Key`);
      await medusa.addSalesChannelsToPublishableKey(apiKey.id, [channel.id]);

      emit({ type: 'step', message: `Import de ${enriched.length} produits dans Medusa...` });

      const productIds: string[] = [];
      let imported = 0;

      for (const ep of enriched) {
        try {
          const handle = slugify(ep.enrichedTitle) + '-' + ep.externalId.slice(0, 8);
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
                  prices: [{ currency_code: 'eur', amount: ep.priceCents }],
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
          productIds.push(medusaProduct.id);

          // Save to store_products table
          await db.query(
            `INSERT INTO dropship_store_products
               (store_id, medusa_product_id, supplier, external_id,
                original_title, enriched_title, enriched_description,
                price_cents, cost_cents, image_url, supplier_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (store_id, supplier, external_id) DO NOTHING`,
            [
              storeId, medusaProduct.id, ep.supplier, ep.externalId,
              ep.originalTitle, ep.enrichedTitle, ep.enrichedDescription,
              ep.priceCents, ep.costCents, ep.imageUrl || null, ep.supplierUrl || null,
            ],
          );

          imported++;
          emit({
            type: 'progress',
            message: `Produit importé (${imported}/${enriched.length}): ${ep.enrichedTitle}`,
            data: { imported, total: enriched.length },
          });
        } catch (err) {
          emit({
            type: 'progress',
            message: `⚠ Produit ignoré: ${ep.enrichedTitle} — ${err instanceof Error ? err.message : 'erreur'}`,
          });
        }
      }

      // Update store with full data
      await db.query(
        `UPDATE dropship_stores SET
           status = 'active',
           tagline = $1,
           description = $2,
           primary_color = $3,
           secondary_color = $4,
           accent_color = $5,
           logo_emoji = $6,
           medusa_sales_channel_id = $7,
           medusa_publishable_key = $8,
           product_count = $9,
           updated_at = now()
         WHERE id = $10`,
        [
          branding.tagline,
          branding.description,
          branding.primaryColor,
          branding.secondaryColor,
          branding.accentColor,
          branding.logoEmoji,
          channel.id,
          apiKey.token,
          imported,
          storeId,
        ],
      );

      emit({
        type: 'success',
        message: `Store "${input.storeName}" créé avec ${imported} produits !`,
        data: {
          storeId,
          slug,
          storeName: input.storeName,
          productCount: imported,
          url: `/shop/${slug}`,
          medusaSalesChannelId: channel.id,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      await db.query(
        `UPDATE dropship_stores SET status = 'error', error_message = $1, updated_at = now() WHERE slug = $2`,
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
