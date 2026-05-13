/**
 * Client-side fetch wrapper that strips any basic-auth credentials embedded
 * in the current URL before constructing the Request. The Fetch spec refuses
 * to build a Request from a URL containing `user:pass@`, so a relative path
 * `fetch('/api/x')` throws synchronously when the page was opened via a URL
 * like `http://admin:pwd@host/...` (a habit when bypassing local basic auth).
 *
 * Using `window.location.origin` here is intentional: the origin never
 * contains the userinfo component, even if `window.location.href` does.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  // `path` is expected to start with `/`. If a caller passes an absolute URL
  // we let it through unchanged.
  const url = /^https?:\/\//.test(path) ? path : `${base}${path}`;
  return fetch(url, init);
}
