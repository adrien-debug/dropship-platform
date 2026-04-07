import { task, logger } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import { generateProductDescription, generateSEOMeta } from '@dropship/ai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const aiEnrich = task({
  id: 'ai-enrich',
  maxDuration: 120,
  run: async (payload: {
    productId: string;
    name: string;
    category: string;
    costCents: number;
  }) => {
    logger.info('Enriching product with AI', { productId: payload.productId });

    const description = await generateProductDescription({
      name: payload.name,
      category: payload.category,
      costCents: payload.costCents,
    });

    const seo = await generateSEOMeta({
      name: payload.name,
      category: payload.category,
      description,
    });

    const { error } = await supabase.from('products').update({
      ai_description: description,
      seo_title: seo.title,
      seo_description: seo.description,
      enriched_at: new Date().toISOString(),
    }).eq('id', payload.productId);

    if (error) {
      logger.error('Failed to save enrichment', { productId: payload.productId, error: error.message });
      throw new Error(`Supabase update failed: ${error.message}`);
    }

    logger.info('AI enrichment saved', {
      productId: payload.productId,
      descLength: description.length,
      seoTitle: seo.title,
    });

    return { description, seo };
  },
});
