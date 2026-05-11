import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Symmetric AES-256-GCM encryption for per-store API tokens at rest.
 *
 * Why: the Meta Conversions API token and the TikTok Events API token sit
 * inside dropship_stores and used to be stored as plain text. Anyone with
 * read access to Postgres could lift them. QW4 of the Phase 0 roadmap
 * mandates encryption at rest with rotation support.
 *
 * Key: `STORE_SECRETS_KEY` env var, base64-encoded 32 random bytes. The
 * helpers throw if the key is absent — fail-closed beats silent
 * un-encryption. Rotation is implemented by issuing a new key, batch
 * re-encrypting every row with the new key, and updating the env var.
 *
 * Format on disk: ciphertext (with the GCM auth tag appended) + a
 * separate 12-byte nonce. Stored in two `bytea` columns (`*_enc`,
 * `*_nonce`). The auth tag lives inside the ciphertext bytes — Node's
 * CipherGCM appends a 16-byte tag at the tail, and our decryptor splits
 * it back off.
 */

const ALGO = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.STORE_SECRETS_KEY?.trim();
  if (!raw) {
    throw new Error(
      'STORE_SECRETS_KEY is not set. Generate one with `openssl rand -base64 32` and add it to .env.local and Vercel env.',
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `STORE_SECRETS_KEY must decode to 32 bytes (got ${key.length}). Regenerate via \`openssl rand -base64 32\`.`,
    );
  }
  cachedKey = key;
  return key;
}

/**
 * Soft check used by call sites that want to fail open when the key is
 * absent in dev / test environments. Production should always have it.
 */
export function secretsConfigured(): boolean {
  const raw = process.env.STORE_SECRETS_KEY?.trim();
  if (!raw) return false;
  try {
    return Buffer.from(raw, 'base64').length === 32;
  } catch {
    return false;
  }
}

export interface EncryptedSecret {
  /** ciphertext with the 16-byte GCM auth tag appended */
  encrypted: Buffer;
  /** 12-byte nonce, unique per encryption */
  nonce: Buffer;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  if (!plaintext) {
    throw new Error('encryptSecret: empty plaintext');
  }
  const key = getKey();
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted: Buffer.concat([enc, tag]), nonce };
}

export function decryptSecret(encrypted: Buffer | Uint8Array, nonce: Buffer | Uint8Array): string {
  const key = getKey();
  const buf = Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted);
  const ivBuf = Buffer.isBuffer(nonce) ? nonce : Buffer.from(nonce);
  if (buf.length <= TAG_BYTES) {
    throw new Error('decryptSecret: ciphertext too short to contain auth tag');
  }
  const ct = buf.subarray(0, buf.length - TAG_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, ivBuf);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/**
 * Convenience for the read path: try to decrypt, return null on any
 * failure (missing key, corrupt ciphertext, wrong tag). Used by
 * `store-config.ts` so a single bad row doesn't 500 the whole storefront.
 */
export function tryDecryptSecret(
  encrypted: Buffer | Uint8Array | null | undefined,
  nonce: Buffer | Uint8Array | null | undefined,
): string | null {
  if (!encrypted || !nonce) return null;
  try {
    return decryptSecret(encrypted, nonce);
  } catch {
    return null;
  }
}
