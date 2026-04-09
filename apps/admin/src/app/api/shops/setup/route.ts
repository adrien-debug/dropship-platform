import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SupplierRouter } from '@dropship/suppliers';

const MEDUSA_URL = process.env['MEDUSA_URL'] ?? 'http://100.110.74.114:9000';
const MEDUSA_ADMIN_EMAIL = process.env['MEDUSA_ADMIN_EMAIL'] ?? '';
const MEDUSA_ADMIN_PASSWORD = process.env['MEDUSA_ADMIN_PASSWORD'] ?? '';
const MEDUSA_REGION_ID = process.env['MEDUSA_REGION_ID'] ?? '';

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

const KEYWORD_TRANSLATIONS: Record<string, string> = {
  montres: 'watches',
  montre: 'watch',
  homme: 'men',
  femme: 'women',
  sacs: 'bags',
  sac: 'bag',
  vetements: 'clothing',
  bijoux: 'jewelry',
  accessoires: 'accessories',
  beaute: 'beauty',
  cosmetique: 'cosmetics',
  figurines: 'figurines',
  manga: 'anime',
  anime: 'anime',
  mugs: 'mugs',
  tshirts: 't-shirts',
  tshirt: 't-shirt',
};

interface SetupBody {
  name: string;
  slug: string;
  port: number;
  niche?: string;
  market?: string;
  positioning?: string;
  designSystem?: string;
  productCount?: number;
  products?: Array<{
    title: string;
    description?: string;
    price?: number;
    cost_cents?: number;
    images?: string[];
    category?: string;
    supplier?: string;
    external_id?: string;
  }>;
}

interface ImportedProductSummary {
  id: string;
  title: string;
  handle: string;
  image: string;
  category: string;
  price: number;
}

interface SetupSourceProduct {
  id: string;
  title: string;
  description?: string;
  image: string;
  priceUsd: number;
  category: string;
  supplier?: string;
}

function getSupabase() {
  const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) throw new Error('Missing Supabase credentials');
  return createClient(SUPABASE_URL, key);
}

function translateToEnglish(keyword: string): string {
  return keyword
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word) => KEYWORD_TRANSLATIONS[word] ?? word)
    .join(' ');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function retailPriceEur(costUsd: number, positioning = 'Milieu de gamme'): number {
  const multiplier = positioning === 'Premium' ? 3.4 : positioning === 'Budget' ? 2.0 : 2.6;
  return Math.max(9.9, Math.round(costUsd * multiplier * 100) / 100);
}

async function medusaAdmin(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${MEDUSA_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Medusa ${res.status} ${path}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function getMedusaAdminToken(): Promise<string> {
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MEDUSA_ADMIN_EMAIL, password: MEDUSA_ADMIN_PASSWORD }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Medusa auth failed (${res.status})`);
  return (await res.json()).token;
}

async function searchSupplierProducts(niche: string) {
  const translated = translateToEnglish(niche);
  const queryWords = translated.split(/\s+/).filter(Boolean);
  const hasAnimeIntent = queryWords.some((word) =>
    ['anime', 'manga', 'figurine', 'figurines', 'merchandise', 'collectible', 'mug', 'mugs', 't-shirt', 't-shirts'].includes(word),
  );
  const productTypeTerms = queryWords.filter((word) =>
    ['figurine', 'figurines', 'merchandise', 'collectible', 'mug', 'mugs', 't-shirt', 't-shirts', 'poster', 'hoodie', 'plush'].includes(word),
  );
  const franchiseTerms = queryWords.filter((word) =>
    !['men', 'women', 'world', 'france', 'europe', 'us', 'merchandise', 'mug', 'mugs', 't-shirt', 't-shirts'].includes(word),
  );
  const searchTerms = [
    ...(hasAnimeIntent ? ['anime figurine', 'anime merchandise', 'anime mug', 'anime t-shirt'] : []),
    productTypeTerms.join(' '),
    `${franchiseTerms.filter((word) => !['one', 'piece'].includes(word)).join(' ')} ${productTypeTerms[0] ?? ''}`.trim(),
    translated,
    queryWords.filter((word) => !['one', 'piece'].includes(word)).join(' '),
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);

  console.log(`[shops/setup] searchTerms:`, searchTerms);
  console.log(`[shops/setup] CJ_DROPSHIPPING_API_KEY present:`, !!process.env.CJ_DROPSHIPPING_API_KEY);
  const router = SupplierRouter.fromEnv();
  const collected: Array<{ id: string; title: string; image: string; priceUsd: number; category: string }> = [];

  for (const term of searchTerms.slice(0, 4)) {
    try {
      console.log(`[shops/setup] Searching supplier for term: "${term}"`);
      const results = await router.search({ keywords: term, limit: 20 });
      console.log(`[shops/setup] Got ${results.length} results for "${term}"`);
      for (const product of results) {
        collected.push({
          id: product.supplierProductId,
          title: product.title,
          image: product.image,
          priceUsd: product.cost,
          category: product.category,
        });
      }
    } catch (err) {
      console.warn(`[shops/setup] Supplier search "${term}" failed:`, err instanceof Error ? err.message : err);
    }
  }

  const coreWords = queryWords
    .filter((word) => !['and', 'the', 'for', 'de', 'la', 'le', 'les'].includes(word))
    .map((word) => word.replace(/(?:es|s|ing)$/, ''));
  const bannedWords = hasAnimeIntent
    ? ['swimsuit', 'bikini', 'one-piece swimsuit', 'triangle one piece', 'swimwear', 'beachwear', 'deer', 'cat figurine', 'baby', 'horror', 'jewelry', 'bracelet', 'necklace', 'earring', 'ring']
    : [];
  const seen = new Set<string>();

  return collected
    .filter((product) => {
      if (!product.title || !product.image || product.priceUsd <= 0) return false;
      const key = `${product.title}::${product.image}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const title = product.title.toLowerCase();
      if (bannedWords.some((word) => title.includes(word))) return false;
      const hasFandomSignal = ['anime', 'cartoon', 'manga', 'character'].some((word) => title.includes(word));
      const hasProductTypeSignal = productTypeTerms.some((word) =>
        title.includes(word.replace(/s$/, '')),
      );
      if (hasAnimeIntent && (!hasFandomSignal || !hasProductTypeSignal)) {
        return false;
      }
      // For generic single-word niches (sport, mode, maison…) CJ returns semantically related
      // products that may not contain the exact keyword — skip strict filtering in that case.
      const isGenericNiche = coreWords.length === 1 && (coreWords[0]?.length ?? 0) <= 8;
      return coreWords.length === 0 || isGenericNiche || coreWords.some((word) => title.includes(word));
    })
    .sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aScore = productTypeTerms.reduce((score, word) => score + (aTitle.includes(word.replace(/s$/, '')) ? 1 : 0), 0);
      const bScore = productTypeTerms.reduce((score, word) => score + (bTitle.includes(word.replace(/s$/, '')) ? 1 : 0), 0);
      return bScore - aScore || a.priceUsd - b.priceUsd;
    })
    .slice(0, 12);
}

async function createMedusaProduct(
  token: string,
  shopSlug: string,
  salesChannelId: string,
  product: {
    title: string;
    description?: string;
    image: string;
    priceUsd: number;
    desiredPrice?: number;
    category: string;
    externalId: string;
    supplier?: string;
  },
  positioning?: string,
) {
  const handle = slugify(`${shopSlug}-${product.title}`);
  const safeCostUsd = Number.isFinite(product.priceUsd) && product.priceUsd > 0 ? product.priceUsd : 3.99;
  const price = Number.isFinite(product.desiredPrice) && (product.desiredPrice ?? 0) > 0
    ? Math.round((product.desiredPrice ?? 0) * 100) / 100
    : retailPriceEur(safeCostUsd, positioning);
  const amount = Math.max(990, Math.round(price * 100));
  const data = await medusaAdmin('/admin/products', token, {
    method: 'POST',
    body: JSON.stringify({
      title: product.title,
      handle,
      description: product.description?.trim() || `${product.title} selected for ${product.category}.`,
      status: 'published',
      sales_channels: [{ id: salesChannelId }],
      images: product.image ? [{ url: product.image }] : [],
      metadata: {
        supplier: product.supplier ?? 'cj',
        external_id: product.externalId,
        cost_cents: Math.round(safeCostUsd * 100),
      },
      options: [{ title: 'Default', values: ['Standard'] }],
      variants: [{
        title: 'Default',
        manage_inventory: false,
        options: { Default: 'Standard' },
        prices: [{ amount, currency_code: 'eur' }],
      }],
    }),
  }) as { product: { id: string; title: string; handle: string } };

  return {
    id: data.product.id,
    title: data.product.title,
    handle: data.product.handle,
    image: product.image,
    category: product.category,
    price,
  } satisfies ImportedProductSummary;
}

function normalizeProvidedProducts(
  products: SetupBody['products'],
): SetupSourceProduct[] {
  if (!Array.isArray(products)) return [];
  return products
    .map((product, index) => {
      const costUsd = typeof product.cost_cents === 'number' && product.cost_cents > 0
        ? product.cost_cents / 100
        : typeof product.price === 'number' && product.price > 0
          ? product.price / 2.5
          : 0;
      return {
        id: product.external_id?.trim() || `provided-${index}`,
        title: product.title?.trim() || '',
        description: product.description?.trim(),
        image: product.images?.[0] ?? '',
        priceUsd: costUsd,
        category: product.category?.trim() || 'General',
        supplier: product.supplier?.trim() || 'manual',
      } satisfies SetupSourceProduct;
    })
    .filter(product => product.title && product.priceUsd > 0);
}

function resolveCatalogSupplier(products: SetupSourceProduct[]): string {
  const suppliers = [...new Set(products.map(product => product.supplier?.toLowerCase()).filter(Boolean))];
  if (suppliers.length === 1) {
    const supplier = suppliers[0];
    return supplier === 'cj' ? 'cjdropshipping' : supplier ?? 'cjdropshipping';
  }
  return suppliers.length > 1 ? 'multi' : 'cjdropshipping';
}

export async function POST(req: NextRequest) {
  const body: SetupBody = await req.json();
  const { name, slug, port, designSystem } = body;

  if (!name || !slug || !port) {
    return NextResponse.json({ error: 'Missing required fields: name, slug, port' }, { status: 400 });
  }

  try {
    console.log('[shops/setup] Medusa auth...');
    const token = await getMedusaAdminToken();

    console.log('[shops/setup] Creating sales channel...');
    const scData = await medusaAdmin('/admin/sales-channels', token, {
      method: 'POST',
      body: JSON.stringify({ name, description: `Auto-created: ${name}` }),
    }) as { sales_channel: { id: string } };
    const salesChannelId = scData.sales_channel.id;

    console.log('[shops/setup] Creating publishable key...');
    const keyData = await medusaAdmin('/admin/api-keys', token, {
      method: 'POST',
      body: JSON.stringify({ title: `Storefront: ${name}`, type: 'publishable' }),
    }) as { api_key: { id: string; token: string } };
    const pubKeyId = keyData.api_key.id;
    const pubKeyToken = keyData.api_key.token;

    await medusaAdmin(`/admin/api-keys/${pubKeyId}/sales-channels`, token, {
      method: 'POST',
      body: JSON.stringify({ add: [salesChannelId] }),
    });

    console.log('[shops/setup] Linking stock locations to sales channel...');
    try {
      const slData = await medusaAdmin('/admin/stock-locations', token) as {
        stock_locations: { id: string }[];
      };
      for (const sl of slData.stock_locations) {
        await medusaAdmin(`/admin/stock-locations/${sl.id}/sales-channels`, token, {
          method: 'POST',
          body: JSON.stringify({ add: [salesChannelId] }),
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('[shops/setup] Stock location link warning:', err);
    }

    const providedProducts = normalizeProvidedProducts(body.products);
    const sourcedProducts: SetupSourceProduct[] = providedProducts.length > 0
      ? providedProducts
      : await searchSupplierProducts(body.niche ?? name).then(products =>
          products.map(product => ({
            id: product.id,
            title: product.title,
            image: product.image,
            priceUsd: product.priceUsd,
            category: product.category,
            supplier: 'cj',
          })),
        );

    if (providedProducts.length > 0) {
      console.log(`[shops/setup] Using ${providedProducts.length} provided products from OpenCLAW...`);
    } else {
      console.log('[shops/setup] Sourcing products from suppliers...');
    }

    if (sourcedProducts.length === 0) {
      throw new Error(`No products found for niche "${body.niche ?? name}"`);
    }

    const productLimit = Math.min(body.productCount || 12, sourcedProducts.length);
    console.log(`[shops/setup] Importing ${productLimit} products into Medusa (parallel, concurrency=5)...`);

    const CONCURRENCY = 5;
    const batch = sourcedProducts.slice(0, productLimit);
    const importedProducts: ImportedProductSummary[] = [];
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        chunk.map(product =>
          createMedusaProduct(token, slug, salesChannelId, {
            title: product.title,
            description: product.description,
            image: product.image,
            priceUsd: product.priceUsd,
            desiredPrice: Array.isArray(body.products)
              ? body.products.find(candidate => candidate.external_id === product.id)?.price
              : undefined,
            category: product.category,
            externalId: product.id,
            supplier: product.supplier,
          }, body.positioning),
        ),
      );
      for (const result of settled) {
        if (result.status === 'fulfilled') {
          importedProducts.push(result.value);
        } else {
          console.error('[shops/setup] Product import failed:', result.reason);
        }
      }
    }
    if (importedProducts.length === 0) {
      throw new Error('Supplier sourcing succeeded but Medusa import failed for all products');
    }

    console.log('[shops/setup] Saving to Supabase...');
    const supabase = getSupabase();
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .insert({
        name,
        slug,
        medusa_sales_channel_id: salesChannelId,
        status: 'building',
        theme: { design_system: designSystem ?? 'swiss' },
        config: {
          port,
          publishable_key: pubKeyToken,
          niche: body.niche,
          market: body.market,
          positioning: body.positioning,
          imported_products: importedProducts.slice(0, 8),
        },
      })
      .select('id')
      .single();

    if (siteError) throw new Error(`Supabase: ${siteError.message}`);

    await supabase.from('catalogs').insert({
      site_id: siteData.id,
      name: `${name} Catalog`,
      supplier: resolveCatalogSupplier(sourcedProducts),
      keywords: [body.niche ?? name],
      margin: body.positioning === 'Premium' ? 220 : body.positioning === 'Budget' ? 110 : 160,
      product_count: importedProducts.length,
      auto_sync: false,
      last_sync_at: new Date().toISOString(),
    });

    console.log(
      `[shops/setup] Done: site=${siteData.id} sc=${salesChannelId} products=${importedProducts.length}`,
    );

    return NextResponse.json({
      siteId: siteData.id,
      salesChannelId,
      publishableKey: pubKeyToken,
      regionId: MEDUSA_REGION_ID,
      importedProducts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[shops/setup] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
