const ALLOWED_TAGS = new Set(['em', 'strong', 'br', 'i', 'b']);
// Matches full blocks whose content must be removed entirely (script, style, etc.)
const BLOCK_CONTENT_REGEX = /<(script|style|noscript|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi;
const TAG_REGEX = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
const ENTITY_AMP = /&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/gi;

/**
 * Sanitize LLM-generated HTML for storefront rendering.
 * Strips every tag except <em>, <strong>, <br>, <i>, <b>. Removes all attributes.
 * Removes full block content for dangerous elements (script, style, iframe…).
 * Safe against <script>, <img onerror>, <a href="javascript:">, etc.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') return '';
  return html
    // 1. Remove dangerous blocks with their content first
    .replace(BLOCK_CONTENT_REGEX, '')
    // 2. Escape bare ampersands
    .replace(ENTITY_AMP, '&amp;')
    // 3. Strip or normalise remaining tags
    .replace(TAG_REGEX, (match, tag) => {
      const lower = String(tag).toLowerCase();
      if (!ALLOWED_TAGS.has(lower)) return '';
      // self-close for br
      if (lower === 'br') return '<br>';
      // strip all attributes — keep just <tag> or </tag>
      return match.startsWith('</') ? `</${lower}>` : `<${lower}>`;
    });
}
