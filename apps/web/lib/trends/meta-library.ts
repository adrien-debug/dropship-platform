import { getDb } from '@/lib/db';
import { trackedMessage } from '@/lib/agent/anthropic';
import { extractJson } from '@/lib/agent/json';

/**
 * P1.2 — Meta Ads Library niche validator.
 *
 * Pre-creation gate: given a niche keyword, estimate how saturated the
 * Meta ads ecosystem already is for it in a target country. The founder
 * uses this to decide whether to spend a 25-40s store-creation cycle on
 * a market that is already over-served.
 *
 * Strategy:
 *   1. Try to fetch the public Meta Ads Library HTML page with a
 *      desktop Chrome User-Agent and extract embedded ad metadata that
 *      Facebook server-renders into the initial payload (JSON blobs
 *      under `__isr_payload`, `RelayPrefetchedStreamCache`, etc).
 *   2. If the HTML scrape yields zero usable ad cards (typical, since
 *      Facebook ships most content via post-render JS bundles, and the
 *      official Ad Library API requires a registered Business app),
 *      fall back to a Claude Haiku estimate that scores saturation
 *      from world knowledge — explicitly framed to the model as a
 *      *plausibility heuristic*, not ground truth.
 *   3. Cache the final envelope in `dropship_trend_snapshots`
 *      (niche, country) keyed, default 24h TTL. Repeat polls on the
 *      same niche are free.
 *
 * The verdict trichotomy (>70 = no-go, 30-70 = caution, <30 = go) is
 * the simplest non-binary signal: enough resolution to tell the
 * founder "stay away" vs "ride this" without pretending we can rank a
 * niche on a fine grain we don't have data for.
 */

export interface NicheValidationResult {
  /** Saturation index 0-100. Higher = more crowded ad inventory. */
  saturation: number;
  verdict: 'go' | 'caution' | 'no-go';
  /** Raw ad volume observed (or estimated). 100+ = market is hot. */
  totalAds: number;
  /** Top advertisers by ad count, max 5. */
  topAdvertisers: Array<{ name: string; pageId?: string; adCount: number }>;
  /** Sample creatives surfaced from the library, max 5. */
  sampleCreatives: Array<{
    adId?: string;
    advertiser: string;
    previewImage?: string;
    landingUrl?: string;
    startedAt?: string;
  }>;
  /** 3 recurring editorial angles surfaced from the visible hooks. */
  angles: string[];
  /** Whether the result came from HTML scrape or Claude fallback. */
  source: 'meta-html' | 'claude-fallback' | 'cache';
  /** Truncated raw HTML snippet for debugging (only when source=meta-html). */
  rawSnippet?: string;
}

export type ValidatorCountry = 'FR' | 'BE' | 'CH' | 'CA';

interface ValidateOpts {
  country?: ValidatorCountry;
  /** Cache lifetime. Default 86400 (24h). Pass 0 to bypass cache write/read. */
  cacheTtlSec?: number;
}

const DEFAULT_CACHE_TTL_SEC = 60 * 60 * 24;

/** Desktop Chrome 132 UA — close enough to a real visitor for the public
 *  Ads Library to honor the SSR path most of the time. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

/**
 * Main entry point. Returns a fully-typed validation result. Never
 * throws on remote failures: all paths converge to either the HTML
 * scrape, the Claude fallback, or a final hard-coded "caution" envelope
 * that lets the admin proceed without misleading data.
 */
export async function validateNiche(
  niche: string,
  opts: ValidateOpts = {},
): Promise<NicheValidationResult> {
  const cleanNiche = niche.trim().toLowerCase();
  if (!cleanNiche) {
    return emptyResult('Niche vide.', 'claude-fallback');
  }
  const country = opts.country ?? 'FR';
  const ttl = opts.cacheTtlSec ?? DEFAULT_CACHE_TTL_SEC;

  // 1. Cache hit short-circuit.
  if (ttl > 0) {
    const cached = await readCache(cleanNiche, country);
    if (cached) {
      return { ...cached, source: 'cache' };
    }
  }

  // 2. HTML scrape attempt.
  let result: NicheValidationResult | null = null;
  try {
    result = await scrapeMetaLibrary(cleanNiche, country);
  } catch (e) {
    // Network / parse failure → fall through to Claude.
    console.warn('[meta-library] scrape failed', e instanceof Error ? e.message : e);
  }

  // 3. Claude fallback if scrape returned nothing usable.
  if (!result || result.totalAds === 0) {
    try {
      result = await estimateWithClaude(cleanNiche, country);
    } catch (e) {
      console.warn('[meta-library] claude fallback failed', e instanceof Error ? e.message : e);
      result = emptyResult(`Validation indisponible pour "${cleanNiche}".`, 'claude-fallback');
    }
  }

  // 4. Cache the resolved envelope (fire-and-forget — never block the
  //    admin on the write).
  if (ttl > 0) {
    void writeCache(cleanNiche, country, result, ttl);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* HTML scraping                                                       */
/* ------------------------------------------------------------------ */

interface ScrapeAd {
  adId?: string;
  advertiser: string;
  pageId?: string;
  previewImage?: string;
  landingUrl?: string;
  startedAt?: string;
  hook?: string;
}

/**
 * Pull the Meta Ads Library search HTML and harvest as many ad cards as
 * the SSR payload exposes. The page uses Relay; advertiser + creative
 * data lives in JSON blobs encoded via the `__isr` shared scripts. We
 * lean on regex + JSON.parse for resilience — the cheerio API would
 * still need to peek into raw `<script>` text anyway.
 *
 * Exported for unit testing under `parseMetaLibraryHtml`.
 */
async function scrapeMetaLibrary(
  niche: string,
  country: ValidatorCountry,
): Promise<NicheValidationResult | null> {
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&q=${encodeURIComponent(niche)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  let html: string;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
      // Facebook redirects through a consent / locale dance on first
      // visit. Follow it.
      redirect: 'follow',
    });
    if (!res.ok) return null;
    html = await res.text();
  } finally {
    clearTimeout(timeout);
  }

  return parseMetaLibraryHtml(html, niche);
}

/**
 * Pure parser used by the scrape path and the unit test. Looks for ad
 * metadata in the embedded JSON, computes a saturation score, and
 * returns the public envelope. Returns null when the HTML carries no
 * recognisable ad payload (e.g. consent wall, login redirect, empty
 * search).
 */
export function parseMetaLibraryHtml(
  html: string,
  // The niche keyword is currently unused in parsing — kept in the
  // signature to make future query-aware filtering (e.g. dropping ads
  // that don't actually match the keyword) a non-breaking change.
  _niche: string,
): NicheValidationResult | null {
  if (!html || typeof html !== 'string') return null;

  // 1. Find total-results hint. Facebook ships strings like
  //    "~1,234 results" or "Environ 1 234 résultats" early in the HTML.
  let totalAds = extractTotalCount(html);

  // 2. Pull ad cards from embedded JSON. We look for repeated
  //    advertiser / snapshot structures with the keys Facebook ships
  //    in the SSR payload.
  const ads = extractAdCandidates(html);
  if (!totalAds && ads.length > 0) totalAds = ads.length;
  if (ads.length === 0 && !totalAds) return null;

  const advertisers = aggregateAdvertisers(ads);
  const samples = ads.slice(0, 5).map((a) => ({
    adId: a.adId,
    advertiser: a.advertiser,
    previewImage: a.previewImage,
    landingUrl: a.landingUrl,
    startedAt: a.startedAt,
  }));
  const angles = topAngles(ads);

  // Saturation index = totalAds capped at 100. 1 ad → 1, 50 → 50, 100+ → 100.
  // Simple, transparent. A more sophisticated curve (logarithmic, weighted by
  // advertiser concentration) can replace this once we have ground-truth
  // labels from validated launches.
  const clampedSaturation = totalAds <= 0 ? 0 : Math.min(100, totalAds);

  return {
    saturation: clampedSaturation,
    verdict: verdictFor(clampedSaturation),
    totalAds,
    topAdvertisers: advertisers,
    sampleCreatives: samples,
    angles,
    source: 'meta-html',
    rawSnippet: html.slice(0, 400),
  };
}

/**
 * Look for textual hints like "1,234 results" / "Environ 1 234 résultats"
 * that Facebook ships in the SSR payload. Returns 0 when no hint is
 * found.
 */
function extractTotalCount(html: string): number {
  const patterns: RegExp[] = [
    /~?\s*([\d.,\s]+)\s*(?:results?|résultats?|annonces?|ads?)\b/i,
    /(?:Environ|About)\s+([\d.,\s]+)\s+(?:results?|résultats?|annonces?|ads?)/i,
    /"total_count":\s*(\d+)/,
    /"totalCount":\s*(\d+)/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1].replace(/[^\d]/g, ''), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return 0;
}

/**
 * Pull ad candidates from the embedded JSON. Facebook varies the exact
 * key names across releases; we try a handful of structures and
 * deduplicate by adId.
 */
function extractAdCandidates(html: string): ScrapeAd[] {
  const out: ScrapeAd[] = [];
  const seen = new Set<string>();

  // Pattern A — `adArchiveID` / `archiveID` blocks (typical Relay shape).
  const blockRe = /\{[^{}]*"(?:adArchiveID|archive_id)"[^{}]*\}/g;
  for (const raw of html.match(blockRe) ?? []) {
    const ad = safeAdFromBlock(raw);
    if (ad && !seen.has(ad.adId ?? '')) {
      seen.add(ad.adId ?? `_${out.length}`);
      out.push(ad);
    }
  }

  // Pattern B — page name + snapshot URL pairs. Useful when Pattern A
  // misses (consent-walled responses still embed some thumbnails).
  const pageRe = /"page_name":"([^"]{2,80})"[^{}]{0,400}?"link_url":"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = pageRe.exec(html)) !== null) {
    const name = decodeJsonString(m[1]!);
    const url = decodeJsonString(m[2]!);
    const key = `${name}::${url}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ advertiser: name, landingUrl: url });
    }
  }

  return out;
}

function safeAdFromBlock(raw: string): ScrapeAd | null {
  try {
    // The captured block is a JSON-looking substring but rarely a
    // complete object — try to repair by trimming until JSON.parse
    // accepts.
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const adId =
      asString(parsed.adArchiveID) ?? asString(parsed.archive_id) ?? undefined;
    const advertiser =
      asString(parsed.pageName) ?? asString(parsed.page_name) ?? 'Unknown advertiser';
    const pageId = asString(parsed.pageID) ?? asString(parsed.page_id) ?? undefined;
    const previewImage =
      asString(parsed.snapshotImage) ?? asString(parsed.snapshot_image) ?? undefined;
    const landingUrl =
      asString(parsed.linkUrl) ?? asString(parsed.link_url) ?? undefined;
    const startedAt =
      asString(parsed.startDate) ?? asString(parsed.start_date) ?? undefined;
    const hook =
      asString(parsed.bodyText) ?? asString(parsed.body_text) ?? asString(parsed.title) ?? undefined;
    return { adId, advertiser, pageId, previewImage, landingUrl, startedAt, hook };
  } catch {
    return null;
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function decodeJsonString(s: string): string {
  try {
    return JSON.parse(`"${s}"`) as string;
  } catch {
    return s;
  }
}

function aggregateAdvertisers(
  ads: ScrapeAd[],
): Array<{ name: string; pageId?: string; adCount: number }> {
  const buckets = new Map<string, { name: string; pageId?: string; adCount: number }>();
  for (const ad of ads) {
    const key = ad.pageId ?? ad.advertiser;
    const cur = buckets.get(key);
    if (cur) {
      cur.adCount += 1;
    } else {
      buckets.set(key, { name: ad.advertiser, pageId: ad.pageId, adCount: 1 });
    }
  }
  return [...buckets.values()]
    .sort((a, b) => b.adCount - a.adCount)
    .slice(0, 5);
}

/**
 * Cheap angle extractor — counts repeated 2-3 word phrases across the
 * visible hooks. Returns at most 3 distinct angles. When there is no
 * usable text, returns an empty array.
 */
function topAngles(ads: ScrapeAd[]): string[] {
  const hooks = ads
    .map((a) => a.hook)
    .filter((s): s is string => typeof s === 'string' && s.length > 4);
  if (hooks.length === 0) return [];

  const freq = new Map<string, number>();
  for (const hook of hooks) {
    const words = hook
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      freq.set(bigram, (freq.get(bigram) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
}

const STOPWORDS = new Set<string>([
  'avec', 'pour', 'dans', 'cette', 'cette', 'votre', 'notre', 'tous',
  'mais', 'plus', 'sans', 'sont', 'this', 'that', 'with', 'your',
  'from', 'have', 'will', 'just', 'about', 'their', 'they', 'them',
]);

/* ------------------------------------------------------------------ */
/* Claude fallback                                                     */
/* ------------------------------------------------------------------ */

interface ClaudePayload {
  saturation: number;
  totalAds: number;
  topAdvertisers: Array<{ name: string; adCount: number }>;
  sampleCreatives: Array<{ advertiser: string; hook?: string }>;
  angles: string[];
}

async function estimateWithClaude(
  niche: string,
  country: ValidatorCountry,
): Promise<NicheValidationResult> {
  const response = await trackedMessage(
    { step: 'niche-validate' },
    {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a dropshipping market analyst. Estimate the Meta (Facebook + Instagram) ad saturation for the niche "${niche}" in country ${country}.

Output ONLY valid JSON. No prose, no fences.

This is a PLAUSIBILITY heuristic, not ground truth — base it on your knowledge of typical dropshipping advertising volume on Meta as of 2025-2026. Return:

{
  "saturation": <integer 0-100, where 0 = nobody is running ads, 100 = extreme saturation like "wireless earbuds" or "blue light glasses">,
  "totalAds": <integer estimate of currently-active ads visible in Meta Ad Library for this niche>,
  "topAdvertisers": [
    { "name": "Plausible-sounding advertiser brand name", "adCount": <int> }
    // up to 5 advertisers, ranked by adCount DESC
  ],
  "sampleCreatives": [
    { "advertiser": "Brand name", "hook": "One-line ad hook (max 90 chars) plausible for this niche on Meta" }
    // up to 5 creatives
  ],
  "angles": [
    "Three short editorial angles (3-5 words each) typical of ads in this niche"
  ]
}`,
        },
      ],
    },
  );

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const parsed = extractJson<ClaudePayload>(text);
  if (!parsed) {
    return emptyResult(`Estimation Claude indisponible pour "${niche}".`, 'claude-fallback');
  }

  const saturation = clampInt(parsed.saturation, 0, 100);
  const totalAds = clampInt(parsed.totalAds, 0, 100_000);

  return {
    saturation,
    verdict: verdictFor(saturation),
    totalAds,
    topAdvertisers: (parsed.topAdvertisers ?? [])
      .slice(0, 5)
      .map((a) => ({ name: String(a.name ?? 'Unknown'), adCount: clampInt(a.adCount, 0, 100_000) })),
    sampleCreatives: (parsed.sampleCreatives ?? []).slice(0, 5).map((c) => ({
      advertiser: String(c.advertiser ?? 'Unknown'),
      previewImage: undefined,
      landingUrl: undefined,
      startedAt: undefined,
      // Re-use the hook field for display as the "title" of the creative.
      adId: undefined,
    })),
    angles: (parsed.angles ?? []).slice(0, 3).map((s) => String(s).slice(0, 60)),
    source: 'claude-fallback',
  };
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function verdictFor(saturation: number): 'go' | 'caution' | 'no-go' {
  if (saturation > 70) return 'no-go';
  if (saturation >= 30) return 'caution';
  return 'go';
}

function clampInt(v: unknown, lo: number, hi: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function emptyResult(
  reason: string,
  source: NicheValidationResult['source'],
): NicheValidationResult {
  return {
    saturation: 0,
    verdict: 'go',
    totalAds: 0,
    topAdvertisers: [],
    sampleCreatives: [],
    angles: [reason],
    source,
  };
}

/* ------------------------------------------------------------------ */
/* Postgres cache                                                       */
/* ------------------------------------------------------------------ */

async function readCache(
  niche: string,
  country: string,
): Promise<NicheValidationResult | null> {
  try {
    const db = getDb();
    const { rows } = await db.query<{ payload: NicheValidationResult }>(
      `SELECT payload FROM dropship_trend_snapshots
       WHERE niche = $1 AND country = $2 AND expires_at > now()
       LIMIT 1`,
      [niche, country],
    );
    return rows[0]?.payload ?? null;
  } catch (e) {
    console.warn('[meta-library] cache read failed', e instanceof Error ? e.message : e);
    return null;
  }
}

async function writeCache(
  niche: string,
  country: string,
  payload: NicheValidationResult,
  ttlSec: number,
): Promise<void> {
  try {
    const db = getDb();
    await db.query(
      `INSERT INTO dropship_trend_snapshots (niche, country, payload, fetched_at, expires_at)
       VALUES ($1, $2, $3::jsonb, now(), now() + ($4 || ' seconds')::interval)
       ON CONFLICT (niche, country)
       DO UPDATE SET
         payload = EXCLUDED.payload,
         fetched_at = EXCLUDED.fetched_at,
         expires_at = EXCLUDED.expires_at`,
      [niche, country, JSON.stringify(payload), String(ttlSec)],
    );
  } catch (e) {
    console.warn('[meta-library] cache write failed', e instanceof Error ? e.message : e);
  }
}
