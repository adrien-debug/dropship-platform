import { task, logger } from '@trigger.dev/sdk/v3';
import { generateProductDescription, generateSEOMeta } from '@dropship/ai';

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

    logger.info('AI enrichment complete', {
      productId: payload.productId,
      descLength: description.length,
      seoTitle: seo.title,
    });

    return { description, seo };
  },
});
