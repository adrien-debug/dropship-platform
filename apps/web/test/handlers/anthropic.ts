import { http, HttpResponse } from 'msw';

/**
 * Anthropic /v1/messages mock with intent detection.
 *
 * The agent pipeline calls Claude in three distinct shapes:
 *
 *   1. **Vision filter** (`image-quality.ts:scoreImage`) — `content` is an
 *      array containing an `{ type: 'image' }` block. We always return a
 *      "clean studio shot" verdict (score 0.8) so the vision gate never
 *      rejects mocked supplier images.
 *
 *   2. **Enrichment** (`store-creator.ts:enrichSupplierProductsWithClaude`) —
 *      prompt contains "Select the best" and a list of raw supplier products.
 *      We echo `enriched-{index}` titles + branding so the pipeline maps
 *      products back by `index`.
 *
 *   3. **Pure generation** (`store-creator.ts:generateProductsWithClaude`) —
 *      prompt contains "Generate" + N + "realistic dropshipping products".
 *      We return N AI-generated product blocks + branding.
 *
 * Other prompts (art-director for ComfyUI) fall to a generic JSON response;
 * the agent treats unparseable Claude output as a recoverable warning.
 */

interface AnthropicRequestBody {
  model?: string;
  max_tokens?: number;
  messages?: Array<{
    role: string;
    content:
      | string
      | Array<{ type: string; text?: string; source?: { url?: string } }>;
  }>;
}

function getUserText(body: AnthropicRequestBody): string {
  const userMsg = body.messages?.find((m) => m.role === 'user');
  if (!userMsg) return '';
  if (typeof userMsg.content === 'string') return userMsg.content;
  return userMsg.content
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text!)
    .join('\n');
}

function hasImageBlock(body: AnthropicRequestBody): boolean {
  const userMsg = body.messages?.find((m) => m.role === 'user');
  if (!userMsg || typeof userMsg.content === 'string') return false;
  return userMsg.content.some((c) => c.type === 'image');
}

/**
 * Build the `messages.create` envelope around a text body. The agent only
 * reads `response.content[0].text` when type==='text', so we keep it minimal.
 */
function reply(text: string) {
  return HttpResponse.json({
    id: 'msg_test_' + Math.random().toString(36).slice(2, 10),
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 500, output_tokens: 800 },
  });
}

function visionVerdictJSON(): string {
  // Score 0.8 keeps the image safely above both thresholds (0.5 collection,
  // 0.65 mono) without making the test fixture look implausibly perfect.
  return JSON.stringify({
    score: 0.8,
    issues: [],
    reason: 'Image studio propre, fond neutre, produit centré.',
  });
}

function enrichmentJSON(text: string): string {
  // Parse the embedded product list (productsJson) and emit one enriched
  // entry per supplied index, up to the requested maxProducts. The prompt
  // contains "Select the best ${maxProducts} products" — we grep it.
  const maxMatch = text.match(/Select the best (\d+) products/);
  const maxProducts = maxMatch ? parseInt(maxMatch[1]!, 10) : 12;

  // Extract supplier list (between "Raw supplier products:" and "Tasks:")
  const listMatch = text.match(/Raw supplier products:\s*([\s\S]*?)\s*Tasks:/);
  let rawItems: Array<{ index: number; cost_eur: number }> = [];
  if (listMatch?.[1]) {
    try {
      rawItems = JSON.parse(listMatch[1]) as Array<{ index: number; cost_eur: number }>;
    } catch {
      // fall through with empty list
    }
  }

  const picked = rawItems.slice(0, maxProducts);
  const products = picked.map((it) => ({
    index: it.index,
    enrichedTitle: `Produit Enrichi ${it.index + 1} – Édition Premium`,
    enrichedDescription:
      'Description enrichie test, mise en avant des bénéfices clés, des matériaux et de la promesse de marque. '.repeat(
        4,
      ),
    retailPriceCents: Math.max(999, Math.round(it.cost_eur * 100 * 2.2)),
    costCents: Math.round(it.cost_eur * 100),
  }));

  return JSON.stringify({
    products,
    branding: {
      tagline: 'L’essentiel du yoga, repensé.',
      description:
        'Une sélection d’accessoires premium, pensés pour les pratiquants exigeants qui cherchent la qualité du matériel et la sobriété du design.',
      primaryColor: '#1a1a2e',
      secondaryColor: '#f5f5f0',
      accentColor: '#d97706',
      logoEmoji: '🧘',
    },
  });
}

function generationJSON(text: string): string {
  const nMatch = text.match(/Number of products needed:\s*(\d+)/);
  const n = nMatch ? parseInt(nMatch[1]!, 10) : 3;

  const products = Array.from({ length: n }, (_, i) => ({
    id: `ai-${String(i + 1).padStart(3, '0')}`,
    originalTitle: `Generated Product ${i + 1}`,
    enrichedTitle: `Produit IA ${i + 1} – Curated Edition`,
    enrichedDescription:
      'Description marketing générée par IA pour ce produit dropshipping. '.repeat(8),
    costCents: 1000 + i * 200,
    retailPriceCents: 2999 + i * 500,
    imageUrl: '',
    supplierUrl: '',
  }));

  return JSON.stringify({
    products,
    branding: {
      tagline: 'Curated by AI, crafted for you.',
      description:
        'Une boutique entièrement imaginée par notre agent IA, où chaque produit a été pensé pour répondre à un besoin précis.',
      primaryColor: '#0f172a',
      secondaryColor: '#fafafa',
      accentColor: '#10b981',
      logoEmoji: '✨',
    },
  });
}

export const anthropicHandlers = [
  http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
    const body = (await request.json()) as AnthropicRequestBody;
    const text = getUserText(body);

    if (hasImageBlock(body)) {
      return reply(visionVerdictJSON());
    }

    if (text.includes('Select the best')) {
      return reply(enrichmentJSON(text));
    }

    if (/Generate\s+\d+\s+realistic dropshipping products/i.test(text)) {
      return reply(generationJSON(text));
    }

    // Art-director (ComfyUI) prompts and any other unknown shapes.
    return reply(
      JSON.stringify({
        hero: 'Cinematic editorial product photograph',
        cutout: 'Single product on dark studio gradient',
        lifestyles: [
          'Indoor sunlit context',
          'Outdoor terrace context',
          'Cafe table context',
        ],
        promo: 'Slow parallax push-in, 5s loop',
      }),
    );
  }),
];
