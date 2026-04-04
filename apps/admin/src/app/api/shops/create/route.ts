import { NextResponse, type NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MEDUSA_URL = process.env['MEDUSA_URL'] ?? 'http://100.110.74.114:9000';
const MEDUSA_ADMIN_EMAIL =
  process.env['MEDUSA_ADMIN_EMAIL'] ?? 'adrien@hearstcorporation.io';
const MEDUSA_ADMIN_PASSWORD =
  process.env['MEDUSA_ADMIN_PASSWORD'] ?? 'Hearst0334';
const MEDUSA_PUBLISHABLE_KEY =
  process.env['MEDUSA_PUBLISHABLE_KEY'] ??
  'REDACTED_MEDUSA_PK';
const MEDUSA_REGION_ID =
  process.env['MEDUSA_REGION_ID'] ?? 'reg_01KNCT3QEHAN10H1R98PM3XT2B';

const GPU2_HOST = process.env['GPU2_HOST'] ?? '100.110.74.114';
const SSH_USER = process.env['GPU_SSH_USER'] ?? 'comput3';
const STOREFRONT_IMAGE = 'onepeace-storefront:v4';

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
    throw new Error(`Medusa auth failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()).token;
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
    body: JSON.stringify({ name, description: `Auto-created: ${name}` }),
  });
  if (!res.ok) {
    throw new Error(
      `Sales channel failed (${res.status}): ${await res.text()}`,
    );
  }
  return (await res.json()).sales_channel.id;
}

async function createProduct(
  token: string,
  product: ProductInput,
  salesChannelId: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    title: product.title,
    handle: slugify(product.title),
    status: 'published',
    sales_channels: [{ id: salesChannelId }],
  };
  if (product.image) body.images = [{ url: product.image }];

  const res = await fetch(`${MEDUSA_URL}/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `Product "${product.title}" failed (${res.status}): ${await res.text()}`,
    );
  }
  return (await res.json()).product.id;
}

// ---------------------------------------------------------------------------
// Docker deployment via SSH
// ---------------------------------------------------------------------------

async function deployStorefront(
  slug: string,
  port: number,
  salesChannelId: string,
): Promise<string> {
  const containerName = `storefront-${slug}`;

  const removeCmd = `docker rm -f ${containerName} 2>/dev/null; `;
  const runCmd = [
    'docker run -d',
    `--name ${containerName}`,
    '--network host',
    '--restart unless-stopped',
    `-e PORT=${port}`,
    `-e SITE_SLUG=${slug}`,
    `-e SALES_CHANNEL_ID=${salesChannelId}`,
    `-e NEXT_PUBLIC_MEDUSA_URL=${MEDUSA_URL}`,
    `-e NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${MEDUSA_PUBLISHABLE_KEY}`,
    `-e NEXT_PUBLIC_MEDUSA_REGION_ID=${MEDUSA_REGION_ID}`,
    `-e NODE_ENV=production`,
    STOREFRONT_IMAGE,
    `npx next start -p ${port}`,
  ].join(' ');

  const sshCmd = `ssh -o StrictHostKeyChecking=no ${SSH_USER}@${GPU2_HOST} "${removeCmd}${runCmd}"`;
  console.log(`[shops/create] Deploy: ${containerName} on :${port}`);

  const { stdout, stderr } = await execAsync(sshCmd, { timeout: 60_000 });
  if (stderr && !stderr.includes('Warning:') && !stderr.includes('Error: No such container')) {
    console.warn(`[shops/create] SSH stderr: ${stderr}`);
  }
  return stdout.trim();
}

async function waitForHealthy(
  port: number,
  maxRetries = 20,
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
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
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
    // Step 1: Medusa auth
    currentStep = 'medusa_auth';
    console.log('[shops/create] Step 1: Medusa auth...');
    const token = await getMedusaAdminToken();

    // Step 2: Sales channel
    currentStep = 'sales_channel';
    console.log('[shops/create] Step 2: Creating sales channel...');
    const salesChannelId = await createSalesChannel(token, name);
    console.log(`[shops/create] Sales channel: ${salesChannelId}`);

    // Step 3: Products
    currentStep = 'products';
    let productsCreated = 0;
    if (products && products.length > 0) {
      console.log(`[shops/create] Step 3: Creating ${products.length} products...`);
      for (const product of products) {
        try {
          await createProduct(token, product, salesChannelId);
          productsCreated++;
        } catch (err) {
          console.error(
            `[shops/create] Product failed:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    // Step 4: Deploy via Docker SSH
    currentStep = 'deploy';
    console.log('[shops/create] Step 4: Deploying on GPU2...');
    const containerId = await deployStorefront(slug, port, salesChannelId);
    console.log(`[shops/create] Container: ${containerId.slice(0, 12)}`);

    // Step 5: Health check
    currentStep = 'health_check';
    console.log('[shops/create] Step 5: Health check...');
    const healthy = await waitForHealthy(port);
    const status = healthy ? 'live' : 'starting';
    console.log(`[shops/create] Status: ${status}`);

    return NextResponse.json(
      {
        success: true,
        shop: {
          name,
          slug,
          url: `http://${GPU2_HOST}:${port}`,
          sales_channel_id: salesChannelId,
          products_created: productsCreated,
          design_system: designSystem ?? 'ds-minimal',
          dark_mode: darkMode ?? false,
          container_id: containerId.slice(0, 12),
          status,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[shops/create] Error at "${currentStep}":`, message);

    return NextResponse.json(
      { error: message, step: currentStep },
      { status: 500 },
    );
  }
}
