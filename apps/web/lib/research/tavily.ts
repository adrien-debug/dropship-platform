/**
 * Minimal Tavily Search API client.
 *
 * Docs: https://docs.tavily.com/api-reference/endpoint/search
 *
 * Why a hand-rolled client and not the official SDK: Tavily ships a tiny
 * single-endpoint REST surface and the platform already standardises on
 * raw `fetch` for outbound integrations (AliExpress, CJ, Meta). Adding a
 * dependency just for one POST would be net-negative.
 *
 * Fail-soft contract: this module never throws on network / API errors.
 * Callers (Claude tool executors) treat empty results as a soft signal
 * and synthesise a graceful "no results" message rather than aborting
 * the conversation. We surface warnings via console.warn for Sentry
 * pickup but the surrounding tool loop keeps going.
 */

export interface TavilyResult {
  title: string;
  url: string;
  snippet: string;
  published?: string;
}

export interface TavilySearchInput {
  query: string;
  /** Max results to return. Default 5, capped to 10. */
  max_results?: number;
  /** Search depth — Tavily charges more for 'advanced' but it yields
   *  better long-tail coverage. Default 'basic'. */
  search_depth?: 'basic' | 'advanced';
  /** 'news' restricts to recent articles within `days`. */
  topic?: 'general' | 'news';
  /** Recency window for 'news' topic. Default 7. */
  days?: number;
}

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const TIMEOUT_MS = 15_000;

/** Read the API key lazily so unit tests can swap process.env at runtime. */
function getApiKey(): string {
  return (process.env.TAVILY_API_KEY || '').trim();
}

/**
 * True iff the Tavily key is present. The research copilot system prompt
 * uses this to tell Claude when web_search is unavailable, so it doesn't
 * waste a turn calling a dead tool.
 */
export function isTavilyConfigured(): boolean {
  return getApiKey().length > 0;
}

/**
 * Run a Tavily search. Returns the top results normalised to a flat
 * shape. Never throws — returns `[]` on any failure.
 */
export async function tavilySearch(input: TavilySearchInput): Promise<TavilyResult[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[tavily] TAVILY_API_KEY is not configured — returning empty results.');
    return [];
  }

  const max = Math.max(1, Math.min(10, input.max_results ?? 5));
  const topic = input.topic ?? 'general';
  const body: Record<string, unknown> = {
    api_key: apiKey,
    query: input.query,
    max_results: max,
    search_depth: input.search_depth ?? 'basic',
    topic,
    include_answer: false,
    include_raw_content: false,
  };
  if (topic === 'news') {
    body.days = Math.max(1, Math.min(30, input.days ?? 7));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[tavily] HTTP ${res.status}: ${text.slice(0, 200)}`);
      return [];
    }
    const json = (await res.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        snippet?: string;
        published_date?: string;
      }>;
    };
    const results = json.results ?? [];
    return results
      .filter((r) => typeof r.url === 'string' && r.url.length > 0)
      .map((r) => ({
        title: (r.title ?? '').slice(0, 240),
        url: r.url as string,
        // Tavily uses `content` for the snippet but older payloads expose
        // `snippet`. Keep both code paths to stay forward-compatible.
        snippet: (r.content ?? r.snippet ?? '').slice(0, 600),
        published: r.published_date,
      }))
      .slice(0, max);
  } catch (e) {
    console.warn('[tavily] request failed', e instanceof Error ? e.message : e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
