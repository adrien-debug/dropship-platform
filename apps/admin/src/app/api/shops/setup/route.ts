import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MEDUSA_URL = process.env['MEDUSA_URL'] ?? 'http://100.110.74.114:9000';
const MEDUSA_ADMIN_EMAIL =
  process.env['MEDUSA_ADMIN_EMAIL'] ?? 'adrien@hearstcorporation.io';
const MEDUSA_ADMIN_PASSWORD =
  process.env['MEDUSA_ADMIN_PASSWORD'] ?? 'Hearst0334';

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

function getSupabase() {
  const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) throw new Error('Missing Supabase credentials');
  return createClient(SUPABASE_URL, key);
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
    throw new Error(`Medusa ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function getMedusaAdminToken(): Promise<string> {
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MEDUSA_ADMIN_EMAIL, password: MEDUSA_ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Medusa auth failed (${res.status})`);
  return (await res.json()).token;
}

interface SetupBody {
  name: string;
  slug: string;
  port: number;
  niche?: string;
  market?: string;
  positioning?: string;
  designSystem?: string;
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
    });
    const salesChannelId = scData.sales_channel.id;

    console.log('[shops/setup] Creating publishable key...');
    const keyData = await medusaAdmin('/admin/api-keys', token, {
      method: 'POST',
      body: JSON.stringify({ title: `Storefront: ${name}`, type: 'publishable' }),
    });
    const pubKeyId = keyData.api_key.id;
    const pubKeyToken = keyData.api_key.token;

    await medusaAdmin(`/admin/api-keys/${pubKeyId}/sales-channels`, token, {
      method: 'POST',
      body: JSON.stringify({ add: [salesChannelId] }),
    });

    console.log('[shops/setup] Saving to Supabase...');
    const supabase = getSupabase();
    const { data: siteData, error: siteError } = await supabase.from('sites').insert({
      name,
      slug,
      medusa_sales_channel_id: salesChannelId,
      status: 'building',
      theme: { design_system: designSystem ?? 'swiss' },
      config: { port, publishable_key: pubKeyToken, niche: body.niche, market: body.market, positioning: body.positioning },
    }).select('id').single();

    if (siteError) throw new Error(`Supabase: ${siteError.message}`);

    console.log(`[shops/setup] Done: site=${siteData.id} sc=${salesChannelId}`);

    return NextResponse.json({
      siteId: siteData.id,
      salesChannelId,
      publishableKey: pubKeyToken,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[shops/setup] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
