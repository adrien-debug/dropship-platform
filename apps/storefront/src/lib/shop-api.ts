/**
 * Browser-only JSON client for `/api/*` routes (proxied to Hearst backend).
 */
export async function shopJson<T>(path: string, init?: RequestInit): Promise<T> {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const url = `/api/${normalized}`;
  const headers: HeadersInit = { ...(init?.headers ?? {}) };
  if (init?.body && typeof init.body === 'string' && !('Content-Type' in headers)) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers,
  });
  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
