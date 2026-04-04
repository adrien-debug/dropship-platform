import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { MedusaClient } from '../services/medusa-client.js';

export const shopCreatorRouter = Router();

const createShopSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  design_system: z.object({
    primary_color: z.string().optional(),
    font: z.string().optional(),
    logo_url: z.string().url().optional(),
  }).optional(),
  products: z.array(z.object({
    source: z.enum(['cj', 'medusa', 'manual']),
    source_id: z.string(),
    title: z.string(),
    price: z.number().positive().optional(),
    margin_percent: z.number().min(0).max(500).default(30),
  })).min(1).max(200),
});

shopCreatorRouter.post('/create', async (req: Request, res: Response) => {
  const parsed = createShopSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }

  const { name, slug, design_system, products } = parsed.data;

  const executionPlan = {
    id: crypto.randomUUID(),
    status: 'planned' as const,
    created_at: new Date().toISOString(),
    shop: { name, slug, design_system },
    steps: [
      {
        step: 1,
        action: 'create_store',
        description: `Create Medusa store "${name}" (slug: ${slug})`,
        status: 'pending',
      },
      {
        step: 2,
        action: 'configure_design',
        description: 'Apply design system (colors, font, logo)',
        status: design_system ? 'pending' : 'skipped',
      },
      {
        step: 3,
        action: 'import_products',
        description: `Import ${products.length} product(s) from suppliers`,
        products: products.map((p) => ({
          title: p.title,
          source: p.source,
          source_id: p.source_id,
          margin_percent: p.margin_percent,
        })),
        status: 'pending',
      },
      {
        step: 4,
        action: 'configure_payments',
        description: 'Set up Stripe payment provider',
        status: 'pending',
      },
      {
        step: 5,
        action: 'configure_shipping',
        description: 'Set up shipping zones and rates',
        status: 'pending',
      },
      {
        step: 6,
        action: 'publish',
        description: 'Publish storefront and verify health',
        status: 'pending',
      },
    ],
  };

  let medusaReachable = false;
  try {
    const medusa = new MedusaClient();
    await medusa.healthCheck();
    medusaReachable = true;
  } catch {
    medusaReachable = false;
  }

  console.log(`[shop-creator] Plan created: ${executionPlan.id} — shop="${name}" slug="${slug}" products=${products.length}`);

  res.status(201).json({
    ...executionPlan,
    medusa_reachable: medusaReachable,
    next: medusaReachable
      ? 'POST /shop/execute with { plan_id } to run the pipeline'
      : 'Medusa is unreachable — fix connectivity before executing',
  });
});
