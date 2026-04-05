import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MEDUSA_URL = process.env['MEDUSA_URL'] ?? 'http://100.110.74.114:9000';
const MEDUSA_ADMIN_EMAIL =
  process.env['MEDUSA_ADMIN_EMAIL'] ?? 'adrien@hearstcorporation.io';
const MEDUSA_ADMIN_PASSWORD =
  process.env['MEDUSA_ADMIN_PASSWORD'] ?? 'Hearst0334';
const MEDUSA_REGION_ID =
  process.env['MEDUSA_REGION_ID'] ?? 'reg_01KNCT3QEHAN10H1R98PM3XT2B';

const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';
const CJ_API_KEY = process.env['CJ_API_KEY'] ?? process.env['CJ_DROPSHIPPING_API_KEY'] ?? '';

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
}

interface CJListV2Response {
  code: number;
  message?: string;
  data?: {
    content?: Array<{
      productList?: Array<{
        id: string;
        nameEn: string;
        bigImage: string;
        sellPrice: string;
        threeCategoryName?: string;
        twoCategoryName?: string;
        oneCategoryName?: string;
      }>;
    }>;
  };
}

interface ImportedProductSummary {
  id: string;
  title: string;
  handle: string;
  image: string;
  category: string;
  price: number;
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

async function getCJAccessToken() {
  if (!CJ_API_KEY) throw new Error('Missing CJ_API_KEY');
  const res = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: CJ_API_KEY }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`CJ auth failed (${res.status})`);
  const json = (await res.json()) as { data?: { accessToken?: string } };
  const token = json.data?.accessToken;
  if (!token) throw new Error('CJ access token missing');
  return token;
}

async function searchCJProducts(niche: string) {
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

  const token = await getCJAccessToken();
  const collected: Array<{ id: string; title: string; image: string; priceUsd: number; category: string }> = [];

  for (const term of searchTerms.slice(0, 4)) {
    const params = new URLSearchParams({
      keyWord: term,
      page: '1',
      size: '20',
    });
    const res = await fetch(`${CJ_BASE_URL}/product/listV2?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        'CJ-Access-Token': token,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) continue;
    const json = (await res.json()) as CJListV2Response;
    for (const group of json.data?.content ?? []) {
      for (const product of group.productList ?? []) {
        collected.push({
          id: product.id,
          title: product.nameEn,
          image: product.bigImage,
          priceUsd: Number(product.sellPrice || 0),
          category: product.threeCategoryName ?? product.twoCategoryName ?? product.oneCategoryName ?? 'General',
        });
      }
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
      return coreWords.length === 0 || coreWords.some((word) => title.includes(word));
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
  product: { title: string; image: string; priceUsd: number; category: string; externalId: string },
  positioning?: string,
) {
  const handle = slugify(`${shopSlug}-${product.title}`);
  const safeCostUsd = Number.isFinite(product.priceUsd) && product.priceUsd > 0 ? product.priceUsd : 3.99;
  const price = retailPriceEur(safeCostUsd, positioning);
  const amount = Math.max(990, Math.round(price * 100));
  const data = await medusaAdmin('/admin/products', token, {
    method: 'POST',
    body: JSON.stringify({
      title: product.title,
      handle,
      description: `${product.title} selected for ${product.category}.`,
      status: 'published',
      sales_channels: [{ id: salesChannelId }],
      images: [{ url: product.image }],
      metadata: {
        supplier: 'cj',
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

    console.log('[shops/setup] Sourcing CJ products...');
    const sourcedProducts = await searchCJProducts(body.niche ?? name);
    if (sourcedProducts.length === 0) {
      throw new Error(`No CJ products found for niche "${body.niche ?? name}"`);
    }

    const productLimit = Math.min(body.productCount || 12, sourcedProducts.length);
    console.log(`[shops/setup] Importing ${productLimit} products into Medusa...`);
    const importedProducts: ImportedProductSummary[] = [];
    for (const product of sourcedProducts.slice(0, productLimit)) {
      try {
        importedProducts.push(await createMedusaProduct(token, slug, salesChannelId, {
          title: product.title,
          image: product.image,
          priceUsd: product.priceUsd,
          category: product.category,
          externalId: product.id,
        }, body.positioning));
      } catch (err) {
        console.error('[shops/setup] Product import failed:', product.title, err);
      }
    }
    if (importedProducts.length === 0) {
      throw new Error('CJ sourcing succeeded but Medusa import failed for all products');
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
      supplier: 'cj',
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
