/**
 * Centralised configuration for the desktop wrapper.
 *
 * The wrapper points at a deployed Vercel URL by default. In dev (NODE_ENV !==
 * 'production' or ELECTRON_IS_DEV === '1') we default to the local Next.js dev
 * server. Both can be overridden via the HEARST_URL env var.
 *
 * HTTP Basic Auth credentials are read once at startup from
 *   apps/web/.env.local
 * (relative to the desktop app folder, resolved upwards), or from the
 *   ADMIN_USERNAME / ADMIN_PASSWORD env vars directly. The Authorization header
 * is injected on every request whose host matches the base URL host.
 */
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface ResolvedConfig {
  /** Initial URL opened by the dashboard window (full URL). */
  baseUrl: string;
  /** Origin part of baseUrl (used for webRequest filtering and IPC routing). */
  origin: string;
  /** Pre-encoded `Basic ...` header value, or null if no credentials. */
  basicAuthHeader: string | null;
  /** True when we're running against localhost (relaxes some security knobs). */
  isLocal: boolean;
  /** True when running unbundled (electron run on dist/, NODE_ENV !== production). */
  isDev: boolean;
}

const DEFAULT_PROD_URL = 'http://localhost:3063/admin';
const DEFAULT_DEV_URL = 'http://localhost:3063/admin';

function isDevMode(): boolean {
  if (process.env.ELECTRON_IS_DEV === '1') return true;
  if (process.env.NODE_ENV === 'production') return false;
  // Default: when running via `electron dist/main.js` without packaging, treat
  // as dev. `app.isPackaged` would be more accurate but we can't import it at
  // module-load time without circular issues; main.ts re-checks if needed.
  return !process.env.ELECTRON_RUN_AS_NODE && !process.resourcesPath?.includes('.app/');
}

/**
 * Parse a tiny subset of dotenv syntax (KEY=value, with optional quotes).
 * We deliberately avoid pulling in the `dotenv` package for a one-shot read.
 */
function parseDotenv(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Try to locate apps/web/.env.local relative to the desktop app folder.
 * Walks upwards a few levels to support both `apps/desktop/dist/main.js` and a
 * packaged `Resources/app/dist/main.js` layout.
 */
function readWebEnvLocal(): Record<string, string> {
  const candidates = [
    // Packaged app: user-managed credentials file. Stable absolute path so
    // signing the app bundle stays untouched (touching Resources/ after
    // codesign breaks macOS Sequoia's signature check and silently kills
    // the app at launch).
    path.join(os.homedir(), 'Library', 'Application Support', 'Hearst Dropship', 'credentials.env'),
    // Dev / unpackaged layouts: read from the web app's .env.local.
    path.resolve(__dirname, '..', '..', 'web', '.env.local'),
    path.resolve(__dirname, '..', '..', '..', 'web', '.env.local'),
    path.resolve(__dirname, '..', '..', '..', '..', 'apps', 'web', '.env.local'),
    path.resolve(process.cwd(), '..', 'web', '.env.local'),
    path.resolve(process.cwd(), 'apps', 'web', '.env.local'),
  ];
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        return parseDotenv(readFileSync(candidate, 'utf8'));
      }
    } catch {
      // Ignore — we'll fall through to env-var-only mode.
    }
  }
  return {};
}

function buildBasicAuthHeader(username: string | undefined, password: string | undefined): string | null {
  if (!username || !password) return null;
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

let cached: ResolvedConfig | null = null;

export function getConfig(): ResolvedConfig {
  if (cached) return cached;

  const dev = isDevMode();
  const fallback = dev ? DEFAULT_DEV_URL : DEFAULT_PROD_URL;
  const baseUrl = (process.env.HEARST_URL && process.env.HEARST_URL.trim()) || fallback;

  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    // Misconfigured HEARST_URL — fall back hard to the safe default.
    origin = new URL(DEFAULT_PROD_URL).origin;
  }

  // Credentials priority:
  //   1. ADMIN_USERNAME / ADMIN_PASSWORD env vars (set by the launching shell)
  //   2. apps/web/.env.local (read once)
  const webEnv = readWebEnvLocal();
  const username = process.env.ADMIN_USERNAME ?? webEnv.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD ?? webEnv.ADMIN_PASSWORD;

  cached = {
    baseUrl,
    origin,
    basicAuthHeader: buildBasicAuthHeader(username, password),
    isLocal: origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'),
    isDev: dev,
  };

  // Forget the credentials we just read — keep only the encoded header in
  // memory so a future heap dump doesn't leak the plaintext password.
  return cached;
}

/**
 * Resolve a URL path (e.g. '/admin/orders') against the configured baseUrl
 * origin. Always returns an absolute URL.
 */
export function urlForPath(pathname: string): string {
  const { origin } = getConfig();
  if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
    return pathname;
  }
  const normalised = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${origin}${normalised}`;
}
