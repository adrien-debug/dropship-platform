import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MEDUSA_URL = process.env['MEDUSA_URL'] ?? 'http://100.110.74.114:9000';
const MEDUSA_ADMIN_EMAIL =
  process.env['MEDUSA_ADMIN_EMAIL'] ?? 'adrien@hearstcorporation.io';
const MEDUSA_ADMIN_PASSWORD =
  process.env['MEDUSA_ADMIN_PASSWORD'] ?? 'Hearst0334';
const MEDUSA_REGION_ID =
  process.env['MEDUSA_REGION_ID'] ?? 'reg_01KNCT3QEHAN10H1R98PM3XT2B';

const GPU2_HOST = process.env['GPU2_HOST'] ?? '100.110.74.114';
const SSH_USER = process.env['GPU_SSH_USER'] ?? 'comput3';
const STOREFRONT_IMAGE = 'onepeace-storefront:v5';
const STRIPE_PK = process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? '';

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

function getSupabase() {
  const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) throw new Error('Missing Supabase credentials');
  return createClient(SUPABASE_URL, key);
}

interface ProductInput {
  title: string;
  price: number;
  image?: string;
  supplier?: string;
}

interface CreateShopBody {
  name: string;
  slug: string;
  port: number;
  designSystem?: string;
  darkMode?: boolean;
  niche?: string;
  market?: string;
  positioning?: string;
  products?: ProductInput[];
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ---------------------------------------------------------------------------
// Medusa helpers
// ---------------------------------------------------------------------------

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

async function createSalesChannel(token: string, name: string): Promise<string> {
  const data = await medusaAdmin('/admin/sales-channels', token, {
    method: 'POST',
    body: JSON.stringify({ name, description: `Auto-created: ${name}` }),
  });
  return data.sales_channel.id;
}

async function createPublishableKey(token: string, title: string, salesChannelId: string): Promise<{ id: string; token: string }> {
  const keyData = await medusaAdmin('/admin/api-keys', token, {
    method: 'POST',
    body: JSON.stringify({ title, type: 'publishable' }),
  });
  const keyId = keyData.api_key.id;
  const keyToken = keyData.api_key.token;

  await medusaAdmin(`/admin/api-keys/${keyId}/sales-channels`, token, {
    method: 'POST',
    body: JSON.stringify({ add: [salesChannelId] }),
  });

  return { id: keyId, token: keyToken };
}

async function createProduct(token: string, product: ProductInput, salesChannelId: string): Promise<string> {
  const body: Record<string, unknown> = {
    title: product.title,
    handle: slugify(product.title),
    status: 'published',
    sales_channels: [{ id: salesChannelId }],
  };
  if (product.image) body.images = [{ url: product.image }];

  const data = await medusaAdmin('/admin/products', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.product.id;
}

// ---------------------------------------------------------------------------
// Docker deployment via SSH
// ---------------------------------------------------------------------------

async function deployStorefront(opts: {
  slug: string;
  port: number;
  siteId: string;
  pubKey: string;
  designSystem: string;
}): Promise<string> {
  const containerName = `storefront-${opts.slug}`;
  const removeCmd = `docker rm -f ${containerName} 2>/dev/null; `;
  const runCmd = [
    'docker run -d',
    `--name ${containerName}`,
    '--network host',
    '--restart unless-stopped',
    `-e PORT=${opts.port}`,
    `-e SITE_SLUG=${opts.slug}`,
    `-e SITE_ID=${opts.siteId}`,
    `-e NEXT_PUBLIC_MEDUSA_URL=${MEDUSA_URL}`,
    `-e NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${opts.pubKey}`,
    `-e NEXT_PUBLIC_MEDUSA_REGION_ID=${MEDUSA_REGION_ID}`,
    `-e NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`,
    `-e NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}`,
    `-e DESIGN_SYSTEM=${opts.designSystem}`,
    `-e NODE_ENV=production`,
    ...(STRIPE_PK ? [`-e NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${STRIPE_PK}`] : []),
    STOREFRONT_IMAGE,
    `npx next start -p ${opts.port}`,
  ].join(' ');

  const sshCmd = `ssh -o StrictHostKeyChecking=no ${SSH_USER}@${GPU2_HOST} "${removeCmd}${runCmd}"`;
  console.log(`[shops/create] Deploy: ${containerName} on :${opts.port}`);

  const { stdout, stderr } = await execAsync(sshCmd, { timeout: 60_000 });
  if (stderr && !stderr.includes('Warning:') && !stderr.includes('Error: No such container')) {
    console.warn(`[shops/create] SSH stderr: ${stderr}`);
  }
  return stdout.trim();
}

async function waitForHealthy(port: number, maxRetries = 20, intervalMs = 3000): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://${GPU2_HOST}:${port}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return true;
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body: CreateShopBody = await req.json();
  const { name, slug, port, designSystem, products } = body;

  if (!name || !slug || !port) {
    return NextResponse.json(
      { error: 'Missing required fields: name, slug, port' },
      { status: 400 },
    );
  }

  let currentStep = '';

  try {
    // Step 1: Medusa auth
    currentStep = 'medusa_auth';
    console.log('[shops/create] Step 1: Medusa auth...');
    const token = await getMedusaAdminToken();

    // Step 2: Sales channel
    currentStep = 'sales_channel';
    console.log('[shops/create] Step 2: Sales channel...');
    const salesChannelId = await createSalesChannel(token, name);
    console.log(`[shops/create] Sales channel: ${salesChannelId}`);

    // Step 3: Per-site publishable key
    currentStep = 'publishable_key';
    console.log('[shops/create] Step 3: Publishable key...');
    const pubKey = await createPublishableKey(token, `Storefront: ${name}`, salesChannelId);
    console.log(`[shops/create] Pub key: ${pubKey.id}`);

    // Step 4: Products
    currentStep = 'products';
    let productsCreated = 0;
    if (products && products.length > 0) {
      console.log(`[shops/create] Step 4: ${products.length} products...`);
      for (const product of products) {
        try {
          await createProduct(token, product, salesChannelId);
          productsCreated++;
        } catch (err) {
          console.error(`[shops/create] Product failed:`, err instanceof Error ? err.message : err);
        }
      }
    }

    // Step 5: Insert site in Supabase
    currentStep = 'supabase_site';
    console.log('[shops/create] Step 5: Supabase site record...');
    const supabase = getSupabase();
    const { data: siteData, error: siteError } = await supabase.from('sites').insert({
      name,
      slug,
      medusa_sales_channel_id: salesChannelId,
      status: 'deploying',
      theme: { design_system: designSystem ?? 'swiss' },
      config: { port, publishable_key: pubKey.token },
    }).select('id').single();

    if (siteError) throw new Error(`Supabase: ${siteError.message}`);
    const siteId = siteData.id;
    console.log(`[shops/create] Site: ${siteId}`);

    // Step 6: Deploy Docker
    currentStep = 'deploy';
    console.log('[shops/create] Step 6: Deploy...');
    const containerId = await deployStorefront({
      slug,
      port,
      siteId,
      pubKey: pubKey.token,
      designSystem: designSystem ?? 'swiss',
    });
    console.log(`[shops/create] Container: ${containerId.slice(0, 12)}`);

    // Step 7: Health check + update status
    currentStep = 'health_check';
    console.log('[shops/create] Step 7: Health check...');
    const healthy = await waitForHealthy(port);
    const status = healthy ? 'live' : 'starting';

    await supabase.from('sites').update({
      status,
      config: { port, publishable_key: pubKey.token, container_id: containerId.slice(0, 12) },
    }).eq('id', siteId);

    console.log(`[shops/create] Done: ${status}`);

    return NextResponse.json({
      success: true,
      shop: {
        name,
        slug,
        site_id: siteId,
        url: `http://${GPU2_HOST}:${port}`,
        sales_channel_id: salesChannelId,
        publishable_key: pubKey.token,
        products_created: productsCreated,
        design_system: designSystem ?? 'swiss',
        container_id: containerId.slice(0, 12),
        status,
      },
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[shops/create] Error at "${currentStep}":`, message);
    return NextResponse.json({ error: message, step: currentStep }, { status: 500 });
  }
}
