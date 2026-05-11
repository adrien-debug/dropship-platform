import Anthropic from '@anthropic-ai/sdk';
import { extractJson } from './json';

/**
 * Claude Vision filter for supplier product images.
 *
 * AliExpress/CJ images are full of disqualifying junk for a premium DTC
 * landing: price stickers ("19.99€"), discount badges ("-50% OFF"), watermarks
 * ("MOQ 100"), text overlays in CJK/Cyrillic, multi-product collages, sellers'
 * faces/hands, etc. We score each candidate with Claude vision and keep only
 * the ones that look like a clean studio shot of *one* product.
 *
 * Cost: ~$0.001 per image with Haiku. We batch up to 10 images per request to
 * cut API roundtrips for ranking.
 */

export interface ImageQualityVerdict {
  /** 0..1 — higher = cleaner. Anything < 0.5 is rejected. */
  score: number;
  /** Specific issues, e.g. ['price_overlay', 'multi_product_collage']. */
  issues: string[];
  /** One-sentence reason in French, shown in the admin log. */
  reason: string;
}

const ISSUE_TAXONOMY = [
  'text_overlay', // any non-trivial text on the image
  'price_tag', // price written on the image
  'discount_badge', // -10%, -50%, "OFF", "SALE", "PROMO"
  'watermark', // seller logo, "MOQ", site URL
  'multi_product_collage', // grid of multiple SKUs
  'human_subject', // faces / hands / models
  'low_quality', // blurry, JPEG artifacts, pixelated
  'busy_background', // distracting non-studio backdrop
] as const;

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Score a single image. Returns ok=false (score=0) on any error so a flaky
 * vision call doesn't poison the ranking.
 */
export async function scoreImage(imageUrl: string): Promise<ImageQualityVerdict> {
  if (!imageUrl) return { score: 0, issues: ['low_quality'], reason: 'Pas d’image' };

  const client = getClient();

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: imageUrl },
            },
            {
              type: 'text',
              text: `You judge product images for a premium DTC e-commerce landing page.

Reject images with ANY of:
- Price tags or amounts written on the image (e.g. "19.99€", "$25")
- Discount/promo badges (e.g. "-10%", "-50% OFF", "SALE", "PROMO")
- Watermarks (seller logos, "MOQ", URLs)
- Text overlays in any language
- Multiple products combined into one composition (collages, grids)
- Human faces, hands holding the product
- Low quality (blurry, pixelated, JPEG artifacts)
- Busy non-studio backgrounds

Return ONLY this JSON, no preamble:
{
  "score": <0.0..1.0 — 1.0 = perfect clean studio shot of one product>,
  "issues": [<subset of: "text_overlay","price_tag","discount_badge","watermark","multi_product_collage","human_subject","low_quality","busy_background">],
  "reason": "<one short sentence in French>"
}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const parsed = extractJson<Partial<ImageQualityVerdict>>(text);
    if (!parsed) {
      return { score: 0, issues: ['low_quality'], reason: 'Réponse vision invalide' };
    }

    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0;
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues.filter((i): i is string => typeof i === 'string' && (ISSUE_TAXONOMY as readonly string[]).includes(i))
      : [];
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : '';

    return { score, issues, reason };
  } catch (e) {
    console.error('[image-quality] vision call failed', e);
    // Fail open at a neutral score so a single broken image doesn't trash a
    // batch — but mark it low so genuinely good images still rank above it.
    return { score: 0.3, issues: ['low_quality'], reason: 'Erreur d’évaluation' };
  }
}

/** Concurrency-bounded batch scoring. */
export async function scoreImages(
  urls: string[],
  concurrency = 4,
): Promise<ImageQualityVerdict[]> {
  const out: ImageQualityVerdict[] = new Array(urls.length);
  let cursor = 0;

  async function worker() {
    while (cursor < urls.length) {
      const i = cursor++;
      out[i] = await scoreImage(urls[i]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return out;
}

/** Convenience: filter a list of items by passing/failing the vision gate. */
export async function filterByImageQuality<T extends { imageUrl: string }>(
  items: T[],
  threshold = 0.5,
): Promise<{ kept: Array<T & { _quality: ImageQualityVerdict }>; rejected: Array<T & { _quality: ImageQualityVerdict }> }> {
  const verdicts = await scoreImages(items.map((it) => it.imageUrl));
  const kept: Array<T & { _quality: ImageQualityVerdict }> = [];
  const rejected: Array<T & { _quality: ImageQualityVerdict }> = [];
  items.forEach((it, i) => {
    const v = verdicts[i]!;
    const tagged = { ...it, _quality: v };
    if (v.score >= threshold) kept.push(tagged);
    else rejected.push(tagged);
  });
  // Sort kept high-to-low so callers can take(N) the best.
  kept.sort((a, b) => b._quality.score - a._quality.score);
  return { kept, rejected };
}
