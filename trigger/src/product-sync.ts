import { task, logger } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import { CJDropshippingClient } from '@dropship/suppliers';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const productSync = task({
  id: 'product-sync',
  maxDuration: 300,
  run: async (payload: { catalogId: string }) => {
    const { catalogId } = payload;
    logger.info('Starting product sync', { catalogId });

    const startTime = Date.now();
    let productsFound = 0;
    let productsAdded = 0;

    const { data: catalog } = await supabase
      .from('catalogs')
      .select('*')
      .eq('id', catalogId)
      .single();

    if (!catalog) throw new Error(`Catalog ${catalogId} not found`);

    await supabase.from('sync_logs').insert({
      catalog_id: catalogId,
      status: 'running',
    });

    try {
      if (catalog.supplier === 'cjdropshipping') {
        const cjKey = process.env.CJ_DROPSHIPPING_API_KEY;
        if (!cjKey) throw new Error('CJ API key not configured');

        const client = new CJDropshippingClient({ apiKey: cjKey });
        const products = await client.searchProducts(catalog.keywords, { limit: 50 });
        productsFound = products.length;

        for (const product of products) {
          const priceCents = Math.round(product.costCents * (1 + catalog.margin / 100));
          logger.info('Synced product', { name: product.name, cost: product.costCents, price: priceCents });
          productsAdded++;
        }
      }

      const durationMs = Date.now() - startTime;

      await supabase.from('sync_logs').insert({
        catalog_id: catalogId,
        status: 'success',
        products_found: productsFound,
        products_added: productsAdded,
        duration_ms: durationMs,
      });

      await supabase.from('catalogs').update({
        product_count: productsAdded,
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
      }).eq('id', catalogId);

      logger.info('Sync complete', { productsFound, productsAdded, durationMs });
      return { productsFound, productsAdded, durationMs };

    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      await supabase.from('sync_logs').insert({
        catalog_id: catalogId,
        status: 'failed',
        error: err,
        duration_ms: Date.now() - startTime,
      });
      await supabase.from('catalogs').update({
        last_sync_error: err,
      }).eq('id', catalogId);
      throw error;
    }
  },
});
