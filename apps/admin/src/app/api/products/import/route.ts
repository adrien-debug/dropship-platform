import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const MEDUSA_URL = (process.env.MEDUSA_URL || 'http://100.110.74.114:9000').replace(/\/$/, '');

const TOKEN_TTL_MS = 3_600_000;
let medusaToken: string | null = null;
let medusaTokenExpiresAt = 0;

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200) || 'product';
}

async function getMedusaAdminToken(): Promise<string> {
  if (medusaToken && Date.now() < medusaTokenExpiresAt) return medusaToken;
  const email = process.env.MEDUSA_ADMIN_EMAIL;
  const password = process.env.MEDUSA_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Medusa admin credentials not configured');
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Medusa auth failed: ${res.status}`);
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error('Medusa auth: no token');
  medusaToken = body.token;
  medusaTokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  return body.token;
}

interface ImportProduct {
  title: string;
  image: string;
  price: number;
  sell_price: number;
  supplier: string;
  category: string;
  external_id?: string;
  shipping_days?: string;
  margin_pct?: number;
  site_id?: string;
  catalog_id?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { products, site_id, catalog_id } = (await req.json()) as {
      products: ImportProduct[];
      site_id?: string;
      catalog_id?: string;
    };

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products provided' }, { status: 400 });
    }

    const supabase = createClient();
    const results: { title: string; status: 'ok' | 'error'; medusa_id?: string; error?: string }[] = [];

    let medusaAvailable = true;
    let token = '';
    try {
      token = await getMedusaAdminToken();
    } catch {
      medusaAvailable = false;
      console.warn('[products/import] Medusa unavailable, importing to Supabase only');
    }

    for (const product of products) {
      try {
        const costCents = Math.round((product.price || 0) * 100);
        const sellCents = Math.round((product.sell_price || product.price * 2.5) * 100);
        const externalId = product.external_id || slugify(product.title);

        // Supabase insert (upsert requires catalog_id for conflict key)
        const row: Record<string, unknown> = {
          name: product.title,
          description: `${product.title} - ${product.category}`,
          image_urls: product.image ? [product.image] : [],
          supplier: product.supplier || 'cj',
          external_id: externalId,
          cost_cents: costCents,
          price_cents: sellCents,
          category: product.category || 'General',
          variants: [],
          in_stock: true,
          synced_at: new Date().toISOString(),
          ...(site_id ? { site_id } : {}),
          ...(catalog_id ? { catalog_id } : {}),
        };

        const { error: sbErr } = catalog_id
          ? await supabase.from('products').upsert(row, { onConflict: 'catalog_id,external_id' })
          : await supabase.from('products').insert(row);

        if (sbErr) {
          console.error('[products/import] Supabase upsert error:', sbErr.message);
        }

        let medusa_id: string | undefined;
        if (medusaAvailable && token) {
          try {
            const handle = slugify(product.title);
            const res = await fetch(`${MEDUSA_URL}/admin/products`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                title: product.title,
                handle,
                status: 'published',
                description: `${product.title} - ${product.category}`,
                images: product.image ? [{ url: product.image }] : [],
                metadata: { supplier: product.supplier || 'cj', external_id: externalId, cost_cents: costCents },
                options: [{ title: 'Default', values: ['Standard'] }],
                variants: [{
                  title: 'Default',
                  manage_inventory: false,
                  options: { Default: 'Standard' },
                  prices: [{ amount: sellCents, currency_code: 'eur' }],
                }],
              }),
              signal: AbortSignal.timeout(15_000),
            });
            if (res.ok) {
              const data = (await res.json()) as { product?: { id: string } };
              medusa_id = data.product?.id;
            }
          } catch (e) {
            console.error('[products/import] Medusa import failed for:', product.title, e instanceof Error ? e.message : e);
          }
        }

        results.push({ title: product.title, status: 'ok', medusa_id });
      } catch (e) {
        results.push({ title: product.title, status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    }

    const ok = results.filter(r => r.status === 'ok').length;
    const failed = results.filter(r => r.status === 'error').length;

    return NextResponse.json({ imported: ok, failed, total: products.length, results, medusa_available: medusaAvailable });
  } catch (err) {
    console.error('[products/import] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
