import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { CJClient } from '../services/cj-client.js';
import { MedusaClient } from '../services/medusa-client.js';

export const productSearchRouter = Router();

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  supplier: z.enum(['cj', 'medusa', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

productSearchRouter.get('/search', async (req: Request, res: Response) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    return;
  }

  const { q, supplier, page, limit } = parsed.data;
  const results: { source: string; products: unknown[] }[] = [];

  try {
    if (supplier === 'cj' || supplier === 'all') {
      const cj = new CJClient();
      const cjProducts = await cj.searchProducts(q, page, limit);
      results.push({ source: 'cj', products: cjProducts });
    }

    if (supplier === 'medusa' || supplier === 'all') {
      const medusa = new MedusaClient();
      const medusaProducts = await medusa.searchProducts(q, page, limit);
      results.push({ source: 'medusa', products: medusaProducts });
    }

    res.json({
      query: q,
      supplier,
      page,
      limit,
      results,
      total: results.reduce((sum, r) => sum + r.products.length, 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[product-search] Search failed for q="${q}": ${message}`);
    res.status(502).json({ error: 'Supplier search failed', message });
  }
});
