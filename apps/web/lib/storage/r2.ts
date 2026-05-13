/**
 * Cloudflare R2 (S3-compatible) storage helper for generated assets.
 *
 * Why R2: Vercel's runtime filesystem outside /tmp is read-only and /tmp
 * doesn't survive a deploy. We were writing ComfyUI outputs to
 * `apps/web/public/generated/...`, which means a second deploy loses every
 * asset of every store. Hard blocker on multi-store scale.
 *
 * R2 is S3-compatible, has zero egress to Vercel/Cloudflare, and gives us a
 * stable public dev URL (`https://pub-<id>.r2.dev`) until a custom CDN domain
 * is wired. We use it as a flat object store keyed by `<slug>/run-<ts>/<file>`.
 *
 * Required env (all 5 must be set for `isR2Configured()` to return true):
 *   - R2_ACCOUNT_ID          → Cloudflare account ID (used to build endpoint)
 *   - R2_BUCKET              → bucket name (e.g. `dropship-assets`)
 *   - R2_ACCESS_KEY_ID       → S3-compat access key from R2 dashboard
 *   - R2_SECRET_ACCESS_KEY   → S3-compat secret key (paired with the above)
 *   - R2_PUBLIC_BASE_URL     → public bucket URL, no trailing slash
 *
 * The S3 client is a lazy singleton: it's only constructed on the first
 * upload, which keeps `next build` happy when the credentials aren't injected
 * at build time (they're runtime-only on Vercel).
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let _client: S3Client | null = null;

/** Cloudflare R2 S3-compatible endpoint, derived from the account ID. */
function r2Endpoint(): string {
  const account = process.env.R2_ACCOUNT_ID;
  if (!account) throw new Error('R2_ACCOUNT_ID is not set');
  return `https://${account}.r2.cloudflarestorage.com`;
}

/**
 * True iff every env var required to talk to R2 is set. Used as the toggle
 * between R2 upload path (prod) and filesystem path (local dev without R2).
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_BUCKET &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_PUBLIC_BASE_URL,
  );
}

/**
 * Lazy singleton S3 client wired for R2. Region must be `auto` — R2 doesn't
 * use AWS regions but the SDK requires the field. forcePathStyle keeps the
 * bucket name in the path rather than the subdomain (matches R2's endpoint
 * shape).
 */
function getClient(): S3Client {
  if (_client) return _client;
  if (!isR2Configured()) {
    throw new Error(
      'R2 is not configured. Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, ' +
        'R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE_URL before calling uploadToR2().',
    );
  }
  _client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint(),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
  return _client;
}

export interface UploadArgs {
  /**
   * Bucket key, e.g. `store-slug/run-2026-01-01T00-00/hero.png`. Leading
   * slashes are stripped — R2 keys are not paths. Convention for store
   * assets: `{slug}/run-{ts}/{filename}.{ext}`.
   */
  key: string;
  /** Raw bytes to upload. Buffer is preferred (Node), Uint8Array also works. */
  body: Buffer | Uint8Array;
  /**
   * Content-Type. Browsers respect it when serving from R2's public URL, so
   * `image/png`, `image/jpeg`, `video/mp4` etc. is mandatory for inline
   * rendering. Defaulting blindly to `application/octet-stream` would force
   * downloads in the storefront.
   */
  contentType: string;
}

/**
 * Upload a buffer to R2 and return the absolute public URL.
 *
 * The returned URL is of the form `${R2_PUBLIC_BASE_URL}/${key}` and is what
 * we persist in the DB (`dropship_stores.hero_image_url` etc.). The
 * storefront renders it via raw `<img src>` — no CDN-side rewrite needed.
 *
 * Throws if R2 isn't configured or if the PUT fails. Callers are expected to
 * `try/catch` and surface the failure as a warning rather than crashing
 * store creation (see asset-generator.ts).
 */
export async function uploadToR2(args: UploadArgs): Promise<string> {
  const key = args.key.replace(/^\/+/, '');
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: args.body,
      ContentType: args.contentType,
    }),
  );
  const base = process.env.R2_PUBLIC_BASE_URL!.replace(/\/+$/, '');
  return `${base}/${key}`;
}
