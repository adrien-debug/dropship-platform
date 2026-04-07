import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { MedusaClient } from '../services/medusa-client.js';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../logger.js';

const execAsync = promisify(exec);

export const shopExecutorRouter = Router();

const GPU2_HOST = process.env['GPU2_HOST'] ?? '100.110.74.114';
const SSH_USER = process.env['GPU_SSH_USER'] ?? 'comput3';
const STOREFRONT_IMAGE = 'onepeace-storefront:v5';
const MEDUSA_REGION_ID = process.env['MEDUSA_REGION_ID'] ?? '';
const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'] ?? '';
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? SUPABASE_ANON_KEY;
const STRIPE_PK = process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? process.env['STRIPE_PUBLISHABLE_KEY'] ?? '';

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

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
    description: z.string().optional(),
    price: z.number().positive().optional(),
    image: z.string().optional(),
    images: z.array(z.string()).optional(),
    seo_title: z.string().optional(),
    seo_description: z.string().optional(),
    cost_cents: z.number().optional(),
    category: z.string().optional(),
    supplier: z.string().optional(),
    external_id: z.string().optional(),
  })).min(1).max(200),
  site_content: z.record(z.unknown()).optional(),
});

shopExecutorRouter.post('/execute', async (req: Request, res: Response) => {
  const parsed = executeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const { name, slug, port, design_system, products, site_content } = parsed.data;
  const results: StepResult[] = [];
  const medusa = new MedusaClient();

  let salesChannelId = '';
  let pubKeyToken = '';
  let siteId = '';

  // Step 1: Create sales channel
  try {
    salesChannelId = await medusa.createSalesChannel(name);
    results.push({ step: 1, action: 'create_sales_channel', status: 'done', detail: salesChannelId });
    logger.info('shop-executor', `Sales channel created: ${salesChannelId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 1, action: 'create_sales_channel', status: 'failed', error: msg });
    logger.error('shop-executor', `Sales channel failed: ${msg}`);
    res.status(500).json({ success: false, results });
    return;
  }

  // Step 2: Create per-site publishable key
  try {
    const key = await medusa.createPublishableKey(`Storefront: ${name}`, salesChannelId);
    pubKeyToken = key.token;
    results.push({ step: 2, action: 'create_publishable_key', status: 'done', detail: key.id });
    logger.info('shop-executor', `Publishable key created: ${key.id}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 2, action: 'create_publishable_key', status: 'failed', error: msg });
    logger.error('shop-executor', `Publishable key failed: ${msg}`);
    res.status(500).json({ success: false, results });
    return;
  }

  // Step 3: Import products (with enriched data if available)
  let productsCreated = 0;
  for (const product of products) {
    try {
      const handle = slug + '-' + product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const allImages = product.images?.length
        ? product.images.map(url => ({ url }))
        : product.image ? [{ url: product.image }] : undefined;

      await medusa.createProduct({
        title: product.title,
        handle,
        description: product.description,
        sales_channels: [{ id: salesChannelId }],
        images: allImages,
        metadata: {
          ...(product.seo_title ? { seo_title: product.seo_title } : {}),
          ...(product.seo_description ? { seo_description: product.seo_description } : {}),
          ...(product.supplier ? { supplier: product.supplier } : {}),
          ...(product.external_id ? { external_id: product.external_id } : {}),
          ...(product.cost_cents ? { cost_cents: product.cost_cents } : {}),
        },
      });
      productsCreated++;
    } catch (err) {
      logger.error('shop-executor', `Product "${product.title}" failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  results.push({ step: 3, action: 'import_products', status: productsCreated > 0 ? 'done' : 'failed', detail: `${productsCreated}/${products.length}` });

  // Step 4: Insert site into Supabase
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('sites').insert({
      name,
      slug,
      medusa_sales_channel_id: salesChannelId,
      status: 'deploying',
      theme: { design_system },
      config: {
        port,
        publishable_key: pubKeyToken,
        ...(site_content ? { site_content } : {}),
      },
    }).select('id').single();

    if (error) throw new Error(error.message);
    siteId = data.id;
    results.push({ step: 4, action: 'create_site_record', status: 'done', detail: siteId });
    logger.info('shop-executor', `Site record created: ${siteId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 4, action: 'create_site_record', status: 'failed', error: msg });
    logger.error('shop-executor', `Supabase insert failed: ${msg}`);
  }

  // Step 5: Deploy storefront (local docker — OpenClaw runs on GPU2)
  let containerId = '';
  try {
    const containerName = `storefront-${slug}`;
    const medusaUrl = process.env['MEDUSA_URL'] ?? `http://${GPU2_HOST}:9000`;

    await execAsync(`docker rm -f ${containerName} 2>/dev/null`, { timeout: 10_000 }).catch(() => {});

    const runCmd = [
      'docker run -d',
      `--name ${containerName}`,
      '--network host',
      '--restart unless-stopped',
      `-e PORT=${port}`,
      `-e SITE_SLUG=${slug}`,
      ...(siteId ? [`-e SITE_ID=${siteId}`] : []),
      `-e NEXT_PUBLIC_MEDUSA_URL=${medusaUrl}`,
      `-e NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${pubKeyToken}`,
      `-e NEXT_PUBLIC_MEDUSA_REGION_ID=${MEDUSA_REGION_ID}`,
      `-e NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`,
      `-e NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}`,
      `-e DESIGN_SYSTEM=${design_system}`,
      `-e NODE_ENV=production`,
      ...(STRIPE_PK ? [`-e NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${STRIPE_PK}`] : []),
      STOREFRONT_IMAGE,
      `npx next start -p ${port}`,
    ].join(' ');

    const { stdout } = await execAsync(runCmd, { timeout: 60_000 });
    containerId = stdout.trim().slice(0, 12);
    results.push({ step: 5, action: 'deploy_storefront', status: 'done', detail: containerId });
    logger.info('shop-executor', `Deployed: ${containerName} on :${port}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ step: 5, action: 'deploy_storefront', status: 'failed', error: msg });
    logger.error('shop-executor', `Deploy failed: ${msg}`);
  }

  // Step 6: Health check + update site status
  let healthy = false;
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(`http://${GPU2_HOST}:${port}`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) { healthy = true; break; }
    } catch { /* not ready */ }
    await new Promise(r => setTimeout(r, 3000));
  }
  results.push({ step: 6, action: 'health_check', status: healthy ? 'done' : 'failed' });

  if (siteId) {
    try {
      const supabase = getSupabase();
      await supabase.from('sites').update({
        status: healthy ? 'live' : 'error',
        config: {
          port,
          publishable_key: pubKeyToken,
          container_id: containerId,
          ...(site_content ? { site_content } : {}),
        },
      }).eq('id', siteId);
    } catch (err) {
      logger.error('shop-executor', `Status update failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Step 7: Create catalog entry
  if (siteId && productsCreated > 0) {
    try {
      const supabase = getSupabase();
      const keywords = products.map(p => p.category).filter(Boolean);
      const uniqueKeywords = [...new Set(keywords)];
      await supabase.from('catalogs').insert({
        site_id: siteId,
        name: `${name} Catalog`,
        supplier: products[0]?.supplier ?? 'cj',
        keywords: uniqueKeywords.length > 0 ? uniqueKeywords : [slug],
        margin: 150,
        product_count: productsCreated,
        auto_sync: false,
        last_sync_at: new Date().toISOString(),
      });
      results.push({ step: 7, action: 'create_catalog', status: 'done', detail: `${productsCreated} products` });
      logger.info('shop-executor', `Catalog created for site ${siteId}`);
    } catch (err) {
      logger.error('shop-executor', `Catalog creation failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  res.status(healthy ? 201 : 207).json({
    success: healthy,
    shop: {
      name,
      slug,
      port,
      site_id: siteId,
      url: `http://${GPU2_HOST}:${port}`,
      sales_channel_id: salesChannelId,
      publishable_key: pubKeyToken,
      products_created: productsCreated,
      design_system,
      container_id: containerId,
      status: healthy ? 'live' : 'starting',
    },
    results,
  });
});
