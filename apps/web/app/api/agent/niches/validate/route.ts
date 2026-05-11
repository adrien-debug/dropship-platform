import { NextRequest } from 'next/server';
import { z } from 'zod';
import { validateNiche } from '@/lib/trends/meta-library';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
// Meta scrape + Claude fallback together stay under 15s, but we leave
// headroom in case Facebook is slow to respond.
export const maxDuration = 30;

const schema = z.object({
  niche: z.string().min(2).max(100),
  country: z.enum(['FR', 'BE', 'CH', 'CA']).optional().default('FR'),
});

/**
 * POST /api/agent/niches/validate
 *
 * Body: { niche: string, country?: 'FR' | 'BE' | 'CH' | 'CA' }
 * Returns: NicheValidationResult (see lib/trends/meta-library.ts)
 *
 * Admin Basic auth is already enforced by middleware. We add a
 * per-IP rate limit (10/min) so a stuck "Valider la niche" button
 * can't hammer Meta and burn our IP reputation.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'niche-validate', { max: 10, windowSec: 60 });
  if (limited) return limited;

  let input: z.infer<typeof schema>;
  try {
    const body = await req.json();
    input = schema.parse(body);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid input' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const result = await validateNiche(input.niche, { country: input.country });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Validation failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
