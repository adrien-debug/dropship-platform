/**
 * Minimal Perplexity Sonar client.
 *
 * Docs: https://docs.perplexity.ai/api-reference/chat-completions
 *
 * Tavily returns raw search results — Perplexity returns a synthesised
 * answer with citations. We use it when the operator wants an analytical
 * answer (e.g. "What's the AOV range for cat tree DTC brands in 2025?")
 * rather than 5 blue links.
 *
 * Fail-soft: a network error returns an empty answer + empty citation
 * list. The system prompt tells Claude to fall back to web_search when
 * this tool returns nothing.
 */

export interface PerplexityAnswer {
  answer: string;
  citations: string[];
}

const PERPLEXITY_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const TIMEOUT_MS = 20_000;
const MODEL = 'sonar';

function getApiKey(): string {
  return (process.env.PERPLEXITY_API_KEY || '').trim();
}

export function isPerplexityConfigured(): boolean {
  return getApiKey().length > 0;
}

/**
 * Ask Perplexity for a citation-backed answer. Returns `{ answer: '',
 * citations: [] }` when the API key is missing or the request fails.
 */
export async function perplexityAnswer(query: string): Promise<PerplexityAnswer> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[perplexity] PERPLEXITY_API_KEY is not configured — returning empty answer.');
    return { answer: '', citations: [] };
  }

  const body = {
    model: MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a market research assistant. Answer concisely with hard numbers and ranges when available. Cite sources. French if the question is French, otherwise English.',
      },
      { role: 'user', content: query },
    ],
    temperature: 0.2,
    return_citations: true,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(PERPLEXITY_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[perplexity] HTTP ${res.status}: ${text.slice(0, 200)}`);
      return { answer: '', citations: [] };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      citations?: unknown;
    };
    const answer = (json.choices?.[0]?.message?.content ?? '').toString();
    const citationsRaw = Array.isArray(json.citations) ? json.citations : [];
    const citations = citationsRaw
      .map((c) => (typeof c === 'string' ? c : ''))
      .filter((c) => c.length > 0)
      .slice(0, 10);
    return { answer: answer.slice(0, 4000), citations };
  } catch (e) {
    console.warn('[perplexity] request failed', e instanceof Error ? e.message : e);
    return { answer: '', citations: [] };
  } finally {
    clearTimeout(timer);
  }
}
