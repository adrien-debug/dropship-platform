/**
 * Extract a JSON object from an LLM free-form text response.
 *
 * Handles the brittleness modes we hit on Haiku outputs:
 *   1. Markdown code fences (```json ... ``` or ``` ... ```).
 *   2. Prose before and/or after the JSON body.
 *   3. Multiple sibling JSON objects in one response (we return the first
 *      balanced one).
 *   4. Strings containing `{` or `}` that would otherwise confuse a greedy
 *      regex extractor.
 *
 * Returns `null` on failure. Callers decide whether to throw, fall back to a
 * default, or surface to Sentry. This module deliberately does no logging — it
 * is a pure parser.
 *
 * The pre-existing extraction was `text.match(/\{[\s\S]*\}/)` which is greedy
 * and picks up trailing prose when Claude appends commentary, *and* fails
 * outright when the response is wrapped in a ```json fence.
 */
export function extractJson<T = unknown>(text: string | null | undefined): T | null {
  if (!text || typeof text !== 'string') return null;

  const candidates = candidateBodies(text);
  for (const body of candidates) {
    try {
      return JSON.parse(body) as T;
    } catch {
      // try next candidate
    }
  }
  return null;
}

/**
 * Produce parseable candidates in best-effort order:
 *   a. The full trimmed text (covers happy path).
 *   b. The content of a ```json or ``` fence, if present.
 *   c. The first balanced {…} block found in the text.
 */
function candidateBodies(text: string): string[] {
  const out: string[] = [];
  const trimmed = text.trim();
  out.push(trimmed);

  const fence = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fence?.[1]) out.push(fence[1].trim());

  const balanced = firstBalancedObject(trimmed);
  if (balanced) out.push(balanced);

  return out;
}

/**
 * Walk the string and return the first balanced `{...}` substring, respecting
 * JSON string literals so braces inside strings do not unbalance the count.
 */
function firstBalancedObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }

  return null;
}
