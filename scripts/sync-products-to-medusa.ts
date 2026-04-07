#!/usr/bin/env npx tsx
/**
 * Sync products from Supabase → Medusa v2
 * Usage: npx tsx scripts/sync-products-to-medusa.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tbachsziohjydqisbfio.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MEDUSA_URL = process.env.MEDUSA_URL || 'http://100.110.74.114:9000';
const MEDUSA_EMAIL = process.env.MEDUSA_EMAIL || '';
const MEDUSA_PASSWORD = process.env.MEDUSA_PASSWORD || '';

if (!MEDUSA_EMAIL || !MEDUSA_PASSWORD) {
  console.error('[sync] MEDUSA_EMAIL and MEDUSA_PASSWORD must be set in environment');
  process.exit(1);
}
const SALES_CHANNEL_ID = process.env.SALES_CHANNEL_ID || 'sc_01KNCS6CB9S8VXD9DZTVW5FN51';

interface SupabaseProduct {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  in_stock: boolean;
  image_urls: string[];
}

async function getMedusaToken(): Promise<string> {
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MEDUSA_EMAIL, password: MEDUSA_PASSWORD }),
  });
  const data = await res.json() as { token: string };
  return data.token;
}

async function fetchSupabaseProducts(): Promise<SupabaseProduct[]> {
  const all: SupabaseProduct[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=*&order=category,name&offset=${offset}&limit=${limit}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const batch = await res.json() as SupabaseProduct[];
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return all;
}

async function getExistingCollections(token: string): Promise<Map<string, string>> {
  const res = await fetch(`${MEDUSA_URL}/admin/product-categories?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as { product_categories: { id: string; name: string }[] };
  const map = new Map<string, string>();
  for (const c of data.product_categories || []) {
    map.set(c.name, c.id);
  }
  return map;
}

async function createCollection(token: string, name: string): Promise<string> {
  const res = await fetch(`${MEDUSA_URL}/admin/product-categories`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, is_active: true, is_internal: false }),
  });
  const data = await res.json() as { product_category: { id: string } };
  return data.product_category.id;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function createProduct(
  token: string,
  product: SupabaseProduct,
  categoryId: string
): Promise<boolean> {
  const handle = slugify(product.name);
  const priceEur = product.price_cents; // already in cents

  const body = {
    title: product.name,
    handle,
    description: product.description || `${product.name} - One Piece`,
    status: product.in_stock ? 'published' : 'draft',
    is_giftcard: false,
    categories: [{ id: categoryId }],
    sales_channels: [{ id: SALES_CHANNEL_ID }],
    images: (product.image_urls || []).map((url) => ({ url })),
    thumbnail: product.image_urls?.[0] || undefined,
    options: [{ title: 'Default', values: ['Default'] }],
    variants: [
      {
        title: 'Default',
        manage_inventory: false,
        prices: [{ amount: priceEur, currency_code: 'eur' }],
        options: { Default: 'Default' },
      },
    ],
    metadata: { supabase_id: product.id, supplier: 'cj-dropshipping' },
  };

  const res = await fetch(`${MEDUSA_URL}/admin/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  FAIL [${product.name}]: ${res.status} ${err.slice(0, 200)}`);
    return false;
  }
  return true;
}

async function main() {
  console.log('=== Sync Supabase → Medusa ===');

  console.log('1. Authenticating...');
  const token = await getMedusaToken();
  console.log('   OK');

  console.log('2. Fetching Supabase products...');
  const products = await fetchSupabaseProducts();
  console.log(`   ${products.length} products found`);

  console.log('3. Syncing categories...');
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const catMap = await getExistingCollections(token);
  for (const cat of categories) {
    if (!catMap.has(cat)) {
      const id = await createCollection(token, cat);
      catMap.set(cat, id);
      console.log(`   Created: ${cat} → ${id}`);
    }
  }
  console.log(`   ${catMap.size} categories ready`);

  console.log('4. Creating products...');
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const catId = catMap.get(p.category) || '';
    const success = await createProduct(token, p, catId);
    if (success) {
      ok++;
    } else {
      fail++;
    }
    if ((i + 1) % 50 === 0) {
      console.log(`   Progress: ${i + 1}/${products.length} (${ok} ok, ${fail} fail)`);
    }
  }

  console.log(`\n=== Done: ${ok} created, ${fail} failed out of ${products.length} ===`);
}

main().catch(console.error);
