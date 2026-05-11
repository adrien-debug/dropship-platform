import { describe, expect, it } from 'vitest';
import { parseMetaLibraryHtml } from './meta-library';

/**
 * The HTML scrape is the brittle path — Facebook ships ad metadata
 * inside JSON blobs that drift across releases. These tests pin the
 * known shapes we currently parse:
 *   - `adArchiveID` / `pageName` block (typical Relay SSR)
 *   - `page_name` + `link_url` pair (consent-walled fallback)
 *   - "About 1,234 results" textual hint for totalAds
 * If Facebook moves the goalposts, these tests will fail loudly and
 * we'll know we need a new pattern.
 */

const SAMPLE_HTML_RICH = `
<!DOCTYPE html>
<html><head><title>Ad Library</title></head>
<body>
<script>
window.__isr = {"data":{"ads":[
  {"adArchiveID":"123456","pageName":"YogaStudioFR","pageID":"100100","snapshotImage":"https://img.fb.com/a.jpg","linkUrl":"https://yogastudio.fr","startDate":"2025-09-01","bodyText":"Tapis de yoga premium éco-responsable"},
  {"adArchiveID":"123457","pageName":"YogaStudioFR","pageID":"100100","snapshotImage":"https://img.fb.com/b.jpg","linkUrl":"https://yogastudio.fr","startDate":"2025-09-15","bodyText":"Tapis de yoga premium pour pratiquant exigeant"},
  {"adArchiveID":"123458","pageName":"ZenLifeFR","pageID":"100200","snapshotImage":"https://img.fb.com/c.jpg","linkUrl":"https://zenlife.fr","startDate":"2025-10-01","bodyText":"Accessoires de méditation pour quotidien zen"}
]}};
</script>
<div>About 1,234 results</div>
</body></html>
`;

const SAMPLE_HTML_CONSENT_WALL = `
<!DOCTYPE html>
<html><body>
<script>
window.__pixel_payload = {"items":[
  {"page_name":"BrandAlpha","link_url":"https://brand-alpha.com"},
  {"page_name":"BrandBeta","link_url":"https://brand-beta.com"},
  {"page_name":"BrandAlpha","link_url":"https://brand-alpha.com/landing-2"}
]};
</script>
</body></html>
`;

const SAMPLE_HTML_EMPTY = `<!DOCTYPE html><html><body><p>No results</p></body></html>`;

describe('parseMetaLibraryHtml', () => {
  it('extracts ad cards from the typical Relay SSR JSON shape', () => {
    const result = parseMetaLibraryHtml(SAMPLE_HTML_RICH, 'yoga');
    expect(result).not.toBeNull();
    expect(result!.totalAds).toBe(1234);
    expect(result!.topAdvertisers).toHaveLength(2);
    expect(result!.topAdvertisers[0]).toEqual({
      name: 'YogaStudioFR',
      pageId: '100100',
      adCount: 2,
    });
    expect(result!.topAdvertisers[1]).toEqual({
      name: 'ZenLifeFR',
      pageId: '100200',
      adCount: 1,
    });
    expect(result!.sampleCreatives.length).toBeGreaterThan(0);
    expect(result!.sampleCreatives[0]?.previewImage).toBe('https://img.fb.com/a.jpg');
    expect(result!.source).toBe('meta-html');
  });

  it('verdict respects the 30/70 thresholds', () => {
    // totalAds = 1234, clamped to saturation = 100 → no-go.
    const result = parseMetaLibraryHtml(SAMPLE_HTML_RICH, 'yoga');
    expect(result!.saturation).toBe(100);
    expect(result!.verdict).toBe('no-go');
  });

  it('falls back to page_name + link_url pairs on consent-walled responses', () => {
    const result = parseMetaLibraryHtml(SAMPLE_HTML_CONSENT_WALL, 'brand');
    expect(result).not.toBeNull();
    expect(result!.totalAds).toBe(3);
    // BrandAlpha appears twice → top advertiser.
    expect(result!.topAdvertisers[0]?.name).toBe('BrandAlpha');
    expect(result!.topAdvertisers[0]?.adCount).toBe(2);
  });

  it('returns null when the HTML carries no recognisable ad payload', () => {
    expect(parseMetaLibraryHtml(SAMPLE_HTML_EMPTY, 'yoga')).toBeNull();
  });

  it('returns null on empty / non-string input', () => {
    expect(parseMetaLibraryHtml('', 'x')).toBeNull();
    expect(parseMetaLibraryHtml(null as unknown as string, 'x')).toBeNull();
  });

  it('extracts angles (recurring bigrams) from hook text when present', () => {
    const result = parseMetaLibraryHtml(SAMPLE_HTML_RICH, 'yoga');
    expect(Array.isArray(result!.angles)).toBe(true);
    // "tapis yoga" or "yoga premium" should surface — both appear twice
    // in the hooks.
    const joined = result!.angles.join(' ');
    expect(joined.length).toBeGreaterThan(0);
  });

  it('handles a totalAds-only HTML (no individual ads parsed)', () => {
    const html = `<html><body><div>"total_count": 42</div></body></html>`;
    const result = parseMetaLibraryHtml(html, 'misc');
    expect(result).not.toBeNull();
    expect(result!.totalAds).toBe(42);
    expect(result!.saturation).toBe(42);
    expect(result!.verdict).toBe('caution');
  });

  it('maps low totalAds to a go verdict', () => {
    const html = `<html><body><div>"total_count": 5</div></body></html>`;
    const result = parseMetaLibraryHtml(html, 'niche');
    expect(result!.saturation).toBe(5);
    expect(result!.verdict).toBe('go');
  });
});
