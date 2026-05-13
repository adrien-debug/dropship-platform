/**
 * Client-side fetch wrapper that strips any basic-auth credentials embedded
 * in the current URL before constructing the Request. The Fetch spec refuses
 * to build a Request from a URL containing `user:pass@`, so a relative path
 * `fetch('/api/x')` throws synchronously when the page was opened via a URL
 * like `http://admin:pwd@host/...` (a habit when bypassing local basic auth).
 *
 * When credentials are present in the href, they are forwarded as an
 * Authorization header so the browser doesn't silently drop them.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (typeof window === 'undefined') return fetch(path, init);

  const href = window.location.href;
  const base = window.location.origin;
  const url = /^https?:\/\//.test(path) ? path : `${base}${path}`;

  // Extract user:pass from the current URL if present.
  const credMatch = href.match(/^https?:\/\/([^:@/]+):([^@/]+)@/);
  if (credMatch) {
    const encoded = btoa(`${credMatch[1]}:${credMatch[2]}`);
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Basic ${encoded}`);
    return fetch(url, { ...init, headers });
  }

  return fetch(url, init);
}
