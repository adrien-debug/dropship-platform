/**
 * Tavily client unit tests.
 *
 * We rely on Vitest's global fetch mock via `vi.stubGlobal('fetch', ...)`
 * — the module reads the API key from process.env lazily so each test
 * can install its own env. We assert:
 *   - isTavilyConfigured() reflects env state.
 *   - tavilySearch() parses the Tavily payload into the public shape
 *     and never throws on error.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalKey = process.env.TAVILY_API_KEY;

beforeEach(() => {
  vi.resetModules();
  delete process.env.TAVILY_API_KEY;
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = originalKey;
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('tavily', () => {
  it('reports configured/unconfigured state from env', async () => {
    const { isTavilyConfigured } = await import('./tavily');
    expect(isTavilyConfigured()).toBe(false);

    process.env.TAVILY_API_KEY = 'tvly-xxx';
    vi.resetModules();
    const m2 = await import('./tavily');
    expect(m2.isTavilyConfigured()).toBe(true);
  });

  it('parses Tavily results into normalised shape', async () => {
    process.env.TAVILY_API_KEY = 'tvly-xxx';
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            title: 'Yoga is booming',
            url: 'https://example.com/a',
            content: 'Long-form snippet of the article body.',
            published_date: '2026-01-15',
          },
          {
            title: 'No content but has url',
            url: 'https://example.com/b',
            snippet: 'short snippet',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { tavilySearch } = await import('./tavily');
    const out = await tavilySearch({ query: 'yoga 2026', max_results: 5 });
    expect(out).toHaveLength(2);
    expect(out[0]!.title).toBe('Yoga is booming');
    expect(out[0]!.url).toBe('https://example.com/a');
    expect(out[0]!.snippet).toContain('Long-form');
    expect(out[1]!.snippet).toBe('short snippet');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toBe('https://api.tavily.com/search');
    const body = JSON.parse(((init as RequestInit).body as string) ?? '{}');
    expect(body.query).toBe('yoga 2026');
    expect(body.max_results).toBe(5);
  });

  it('returns [] on HTTP error without throwing', async () => {
    process.env.TAVILY_API_KEY = 'tvly-xxx';
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    });
    vi.stubGlobal('fetch', fetchMock);

    const { tavilySearch } = await import('./tavily');
    const out = await tavilySearch({ query: 'anything' });
    expect(out).toEqual([]);
  });
});
