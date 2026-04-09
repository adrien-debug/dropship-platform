import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const MEDUSA_URL = (process.env.MEDUSA_URL || 'http://100.110.74.114:9000').replace(/\/$/, '');

const TOKEN_TTL_MS = 3_600_000; // 1h
let medusaToken: string | null = null;
let medusaTokenExpiresAt = 0;

function slugify(s: string): string {
  const out = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return out.slice(0, 200) || 'product';
}

async function getMedusaAdminToken(): Promise<string> {
  if (medusaToken && Date.now() < medusaTokenExpiresAt) {
    return medusaToken;
  }

  const email = process.env.MEDUSA_ADMIN_EMAIL;
  const password = process.env.MEDUSA_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('[admin:products] MEDUSA_ADMIN_EMAIL or MEDUSA_ADMIN_PASSWORD missing');
    throw new Error('Medusa admin credentials not configured');
  }

  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[admin:products] Medusa auth failed:', res.status, body.slice(0, 200));
    throw new Error(`Medusa auth failed: ${res.status}`);
  }

  const body = (await res.json()) as { token?: string };
  const token = body.token;
  if (!token) {
    console.error('[admin:products] Medusa auth response missing token');
    throw new Error('Medusa auth: no token in response');
  }

  medusaToken = token;
  medusaTokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  return token;
}

async function medusaAdminFetch(path: string, init: RequestInit): Promise<Response> {
  const token = await getMedusaAdminToken();
  return fetch(`${MEDUSA_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = req.nextUrl;
    const supplier = searchParams.get('supplier');
    const catalogId = searchParams.get('catalog_id');
    const search = searchParams.get('q');
    const limit = Math.min(Number(searchParams.get('limit') ?? 500), 1000);
    const offset = Number(searchParams.get('offset') ?? 0);

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('synced_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (supplier) query = query.eq('supplier', supplier);
    if (catalogId) query = query.eq('catalog_id', catalogId);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, count, error } = await query;

    if (error) {
      console.error('[admin:products] Supabase error:', error.message);
      return NextResponse.json({ items: [], total: 0, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [], total: count ?? 0 });
  } catch (err) {
    console.error('[admin:products] Fetch error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ items: [], total: 0 }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const product = (await req.json()) as Record<string, unknown>;

    const title =
      (typeof product.title === 'string' && product.title) ||
      (typeof product.name === 'string' && product.name) ||
      '';
    if (!title) {
      return NextResponse.json({ error: 'Missing title or name' }, { status: 400 });
    }

    const handle =
      typeof product.handle === 'string' && product.handle
        ? product.handle
        : slugify(title);

    const status =
      typeof product.status === 'string' ? product.status : 'published';
    const description =
      typeof product.description === 'string' ? product.description : undefined;

    const priceAmount =
      typeof product.price_cents === 'number'
        ? product.price_cents
        : typeof product.price === 'number'
          ? Math.round(product.price * 100)
          : 1999;

    const body: Record<string, unknown> = {
      title,
      handle,
      status,
      ...(description !== undefined ? { description } : {}),
      options: product.options ?? [{ title: 'Default', values: ['Standard'] }],
      variants:
        product.variants ??
        [
          {
            title: 'Default',
            options: { Default: 'Standard' },
            prices: [{ amount: priceAmount, currency_code: 'eur' }],
          },
        ],
      ...(Array.isArray(product.images) ? { images: product.images } : {}),
      ...(product.metadata && typeof product.metadata === 'object'
        ? { metadata: product.metadata }
        : {}),
      ...(Array.isArray(product.sales_channels) ? { sales_channels: product.sales_channels } : {}),
      ...(Array.isArray(product.categories) ? { categories: product.categories } : {}),
    };

    const res = await medusaAdminFetch('/admin/products', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[admin:products] Medusa create failed:', res.status, errText.slice(0, 400));
      return NextResponse.json(
        { error: 'Medusa product create failed', status: res.status },
        { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
      );
    }

    const data = (await res.json()) as { product?: unknown };
    return NextResponse.json({ ok: true, product: data.product ?? data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin:products] POST error:', msg);
    if (msg.includes('credentials not configured')) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const res = await medusaAdminFetch(`/admin/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[admin:products] Medusa delete failed:', res.status, errText.slice(0, 400));
      return NextResponse.json(
        { error: 'Medusa product delete failed', status: res.status },
        { status: res.status === 404 ? 404 : res.status >= 400 && res.status < 600 ? res.status : 502 }
      );
    }

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* empty body */
    }
    return NextResponse.json({ ok: true, ...(data && typeof data === 'object' ? data : {}) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin:products] DELETE error:', msg);
    if (msg.includes('credentials not configured')) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
