import { NextResponse, type NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@/lib/supabase-server';

const execAsync = promisify(exec);

const MEDUSA_URL = 'http://100.110.74.114:9000';
const MEDUSA_ADMIN_EMAIL = 'adrien@hearstcorporation.io';
const MEDUSA_ADMIN_PASSWORD = 'Hearst0334';
const MEDUSA_PUBLISHABLE_KEY =
  'REDACTED_MEDUSA_PK';
const MEDUSA_REGION_ID = 'reg_01KNCT3QEHAN10H1R98PM3XT2B';
const GPU2_HOST = '100.110.74.114';
const SSH_USER = 'comput3';

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

async function getMedusaAdminToken(): Promise<string> {
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: MEDUSA_ADMIN_EMAIL,
      password: MEDUSA_ADMIN_PASSWORD,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Medusa auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.token;
}

async function createSalesChannel(
  token: string,
  name: string,
): Promise<string> {
  const res = await fetch(`${MEDUSA_URL}/admin/sales-channels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      description: `Auto-created shop: ${name}`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create sales channel failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.sales_channel.id;
}

async function createProduct(
  token: string,
  product: ProductInput,
  salesChannelId: string,
): Promise<string> {
  const handle = slugify(product.title);

  const body: Record<string, unknown> = {
    title: product.title,
    handle,
    status: 'published',
    sales_channels: [{ id: salesChannelId }],
  };

  if (product.image) {
    body.images = [{ url: product.image }];
  }

  const res = await fetch(`${MEDUSA_URL}/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Create product "${product.title}" failed (${res.status}): ${text}`,
    );
  }

  const data = await res.json();
  return data.product.id;
}

async function insertSiteInSupabase(
  name: string,
  slug: string,
  port: number,
  designSystem: string | undefined,
  salesChannelId: string,
) {
  const supabase = createClient();

  const { error } = await supabase.from('sites').insert({
    name,
    slug,
    domain: `http://${GPU2_HOST}:${port}`,
    status: 'deploying',
    config: { design_system: designSystem ?? 'ds-minimal', port },
    sales_channel_id: salesChannelId,
  });

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }
}

async function deployStorefront(slug: string, port: number) {
  const containerName = `storefront-${slug}`;
  const envVars = [
    `-e PORT=${port}`,
    `-e SITE_SLUG=${slug}`,
    `-e NEXT_PUBLIC_MEDUSA_URL=${MEDUSA_URL}`,
    `-e NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${MEDUSA_PUBLISHABLE_KEY}`,
    `-e NEXT_PUBLIC_MEDUSA_REGION_ID=${MEDUSA_REGION_ID}`,
    `-e NODE_ENV=production`,
  ].join(' ');

  const dockerCmd = [
    'docker run -d',
    `--name ${containerName}`,
    '--network host',
    '--restart unless-stopped',
    envVars,
    'onepeace-storefront:v4',
    `npx next start -p ${port}`,
  ].join(' ');

  const sshCmd = `ssh ${SSH_USER}@${GPU2_HOST} "${dockerCmd}"`;

  console.log(`[shops/create] Deploying: ${sshCmd}`);
  const { stdout, stderr } = await execAsync(sshCmd, { timeout: 60_000 });

  if (stderr && !stderr.includes('Warning:')) {
    console.warn(`[shops/create] SSH stderr: ${stderr}`);
  }

  return stdout.trim();
}

async function waitForHealthy(
  port: number,
  maxRetries = 10,
  intervalMs = 3000,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://${GPU2_HOST}:${port}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

async function updateSiteStatus(slug: string, status: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from('sites')
    .update({ status })
    .eq('slug', slug);

  if (error) {
    throw new Error(`Supabase update failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body: CreateShopBody = await req.json();
  const { name, slug, port, designSystem, darkMode, products } = body;

  if (!name || !slug || !port) {
    return NextResponse.json(
      { error: 'Missing required fields: name, slug, port' },
      { status: 400 },
    );
  }

  let currentStep = '';

  try {
    // --- Step 1: Medusa auth ---
    currentStep = 'medusa_auth';
    console.log('[shops/create] Step 1: Authenticating with Medusa...');
    const token = await getMedusaAdminToken();
    console.log('[shops/create] Medusa auth OK');

    // --- Step 2: Create sales channel ---
    currentStep = 'sales_channel';
    console.log('[shops/create] Step 2: Creating sales channel...');
    const salesChannelId = await createSalesChannel(token, name);
    console.log(`[shops/create] Sales channel created: ${salesChannelId}`);

    // --- Step 3: Create products ---
    currentStep = 'products';
    console.log(
      `[shops/create] Step 3: Creating ${products?.length ?? 0} products...`,
    );
    let productsCreated = 0;

    if (products && products.length > 0) {
      for (const product of products) {
        try {
          await createProduct(token, product, salesChannelId);
          productsCreated++;
        } catch (err) {
          console.error(
            `[shops/create] Failed to create product "${product.title}":`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
    console.log(`[shops/create] Products created: ${productsCreated}`);

    // --- Step 4: Insert site in Supabase ---
    currentStep = 'supabase_insert';
    console.log('[shops/create] Step 4: Inserting site in Supabase...');
    await insertSiteInSupabase(name, slug, port, designSystem, salesChannelId);
    console.log('[shops/create] Supabase insert OK');

    // --- Step 5: Deploy storefront ---
    currentStep = 'deploy';
    console.log('[shops/create] Step 5: Deploying storefront on GPU2...');
    const containerId = await deployStorefront(slug, port);
    console.log(`[shops/create] Container started: ${containerId}`);

    // --- Step 6: Health check & update status ---
    currentStep = 'health_check';
    console.log('[shops/create] Step 6: Waiting for storefront to be healthy...');
    const healthy = await waitForHealthy(port);

    if (healthy) {
      await updateSiteStatus(slug, 'live');
      console.log('[shops/create] Storefront is live!');
    } else {
      await updateSiteStatus(slug, 'unhealthy');
      console.warn('[shops/create] Storefront did not become healthy in time');
    }

    const url = `http://${GPU2_HOST}:${port}`;

    return NextResponse.json(
      {
        success: true,
        shop: {
          name,
          slug,
          url,
          sales_channel_id: salesChannelId,
          products_created: productsCreated,
          design_system: designSystem ?? 'ds-minimal',
          dark_mode: darkMode ?? false,
          status: healthy ? 'live' : 'unhealthy',
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[shops/create] Error at step "${currentStep}":`, message);

    if (currentStep === 'deploy' || currentStep === 'health_check') {
      try {
        await updateSiteStatus(slug, 'failed');
      } catch {
        // best-effort status update
      }
    }

    return NextResponse.json(
      {
        error: message,
        step: currentStep,
      },
      { status: 500 },
    );
  }
}
