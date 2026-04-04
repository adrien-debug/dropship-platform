import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { MedusaClient } from '../services/medusa-client.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const shopExecutorRouter = Router();

const GPU2_HOST = process.env['GPU2_HOST'] ?? '100.110.74.114';
const SSH_USER = process.env['GPU_SSH_USER'] ?? 'comput3';
const STOREFRONT_IMAGE = 'onepeace-storefront:v4';
const MEDUSA_PUBLISHABLE_KEY = process.env['MEDUSA_PUBLISHABLE_KEY'] ?? 'REDACTED_MEDUSA_PK';
const MEDUSA_REGION_ID = process.env['MEDUSA_REGION_ID'] ?? 'reg_01KNCT3QEHAN10H1R98PM3XT2B';
const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'] ?? '';
const STRIPE_PK = process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? process.env['STRIPE_PUBLISHABLE_KEY'] ?? '';

interface StepResult {
  step: number;
  action: string;
  status: 'done' | 'failed' | 'skipped';
  detail?: string;
  error?: string;
}

const executeSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  port: z.number().int().min(3100).max(3199),
  design_system: z.string().default('swiss'),
  products: z.array(z.object({
    title: z.string(),
    price: z.number().positive().optional(),
    image: z.string().optional(),
  })).min(1).max(200),
});

shopExecutorRouter.post('/execute', async (req: Request, res: Response) => {
  const parsed = executeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const { name, slug, port, design_system, products } = parsed.data;
  const results: StepResult[] = [];
  const medusa = new MedusaClient();

  let salesChannelId = '';

  // Step 1: Create sales channel
  try {
    salesChannelId = await medusa.createSalesChannel(name);
    results.push({ step: 1, action: 'create_sales_channel', status: 'done', detail: salesChannelId });
    console.log(`[shop-executor] Sales channel created: ${salesChannelId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 1, action: 'create_sales_channel', status: 'failed', error: msg });
    console.error(`[shop-executor] Sales channel failed: ${msg}`);
    res.status(500).json({ success: false, results });
    return;
  }

  // Step 2: Import products
  let productsCreated = 0;
  for (const product of products) {
    try {
      const handle = slug + '-' + product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      await medusa.createProduct({
        title: product.title,
        handle,
        sales_channels: [{ id: salesChannelId }],
        images: product.image ? [{ url: product.image }] : undefined,
      });
      productsCreated++;
    } catch (err) {
      console.error(`[shop-executor] Product "${product.title}" failed:`, err instanceof Error ? err.message : err);
    }
  }
  results.push({ step: 2, action: 'import_products', status: productsCreated > 0 ? 'done' : 'failed', detail: `${productsCreated}/${products.length}` });

  // Step 3: Deploy storefront
  let containerId = '';
  try {
    const containerName = `storefront-${slug}`;
    const medusaUrl = `http://${GPU2_HOST}:9000`;
    const removeCmd = `docker rm -f ${containerName} 2>/dev/null; `;
    const runCmd = [
      'docker run -d',
      `--name ${containerName}`,
      '--network host',
      '--restart unless-stopped',
      `-e PORT=${port}`,
      `-e SITE_SLUG=${slug}`,
      `-e NEXT_PUBLIC_MEDUSA_URL=${medusaUrl}`,
      `-e NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${MEDUSA_PUBLISHABLE_KEY}`,
      `-e NEXT_PUBLIC_MEDUSA_REGION_ID=${MEDUSA_REGION_ID}`,
      `-e NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`,
      `-e NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}`,
      `-e DESIGN_SYSTEM=${design_system}`,
      `-e NODE_ENV=production`,
      ...(STRIPE_PK ? [`-e NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${STRIPE_PK}`] : []),
      STOREFRONT_IMAGE,
      `npx next start -p ${port}`,
    ].join(' ');

    const sshCmd = `ssh -o StrictHostKeyChecking=no ${SSH_USER}@${GPU2_HOST} "${removeCmd}${runCmd}"`;
    const { stdout } = await execAsync(sshCmd, { timeout: 60_000 });
    containerId = stdout.trim().slice(0, 12);
    results.push({ step: 3, action: 'deploy_storefront', status: 'done', detail: containerId });
    console.log(`[shop-executor] Deployed: ${containerName} on :${port}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 3, action: 'deploy_storefront', status: 'failed', error: msg });
    console.error(`[shop-executor] Deploy failed: ${msg}`);
  }

  // Step 4: Health check
  let healthy = false;
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(`http://${GPU2_HOST}:${port}`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) { healthy = true; break; }
    } catch { /* not ready */ }
    await new Promise(r => setTimeout(r, 3000));
  }
  results.push({ step: 4, action: 'health_check', status: healthy ? 'done' : 'failed' });

  res.status(healthy ? 201 : 207).json({
    success: healthy,
    shop: {
      name,
      slug,
      port,
      url: `http://${GPU2_HOST}:${port}`,
      sales_channel_id: salesChannelId,
      products_created: productsCreated,
      design_system,
      container_id: containerId,
      status: healthy ? 'live' : 'starting',
    },
    results,
  });
});
