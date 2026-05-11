#!/usr/bin/env node
/**
 * One-off migration: encrypt every plain-text per-store CAPI / Events
 * token already in dropship_stores, then NULL the plain columns.
 *
 * Idempotent: rows that already have a ciphertext are skipped.
 *
 * Usage (from apps/web/):
 *   STORE_SECRETS_KEY=... DATABASE_URL=... node scripts/encrypt-existing-tokens.mjs
 *
 * Pre-req: apply infra/postgres/011_token_encryption.sql first.
 */

import { createCipheriv, randomBytes } from 'node:crypto';
import pg from 'pg';

const ALGO = 'aes-256-gcm';
const NONCE_BYTES = 12;

function getKey() {
  const raw = (process.env.STORE_SECRETS_KEY || '').trim();
  if (!raw) {
    throw new Error('STORE_SECRETS_KEY is not set.');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`STORE_SECRETS_KEY must decode to 32 bytes (got ${key.length}).`);
  }
  return key;
}

function encryptSecret(plaintext, key) {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted: Buffer.concat([enc, tag]), nonce };
}

async function main() {
  const key = getKey();
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  const pool = new pg.Pool({ connectionString: dbUrl, ssl: false });

  const { rows } = await pool.query(`
    SELECT id, slug, meta_capi_token, tiktok_events_token,
           meta_capi_token_enc, tiktok_events_token_enc
      FROM dropship_stores
     WHERE (meta_capi_token IS NOT NULL AND meta_capi_token_enc IS NULL)
        OR (tiktok_events_token IS NOT NULL AND tiktok_events_token_enc IS NULL)
  `);

  if (rows.length === 0) {
    console.log('✓ Nothing to encrypt — every stored token already has a ciphertext.');
    await pool.end();
    return;
  }

  console.log(`▸ ${rows.length} store(s) to migrate.`);

  let okMeta = 0;
  let okTiktok = 0;

  for (const row of rows) {
    const updates = [];
    const values = [];
    let i = 1;

    if (row.meta_capi_token && !row.meta_capi_token_enc) {
      const { encrypted, nonce } = encryptSecret(row.meta_capi_token, key);
      updates.push(`meta_capi_token = NULL`);
      updates.push(`meta_capi_token_enc = $${i++}`);
      values.push(encrypted);
      updates.push(`meta_capi_token_nonce = $${i++}`);
      values.push(nonce);
      okMeta++;
    }

    if (row.tiktok_events_token && !row.tiktok_events_token_enc) {
      const { encrypted, nonce } = encryptSecret(row.tiktok_events_token, key);
      updates.push(`tiktok_events_token = NULL`);
      updates.push(`tiktok_events_token_enc = $${i++}`);
      values.push(encrypted);
      updates.push(`tiktok_events_token_nonce = $${i++}`);
      values.push(nonce);
      okTiktok++;
    }

    if (updates.length === 0) continue;
    updates.push(`updated_at = now()`);
    values.push(row.id);
    await pool.query(`UPDATE dropship_stores SET ${updates.join(', ')} WHERE id = $${i}`, values);
    console.log(`  ✓ ${row.slug}`);
  }

  console.log(`\n✓ Done. meta_capi: ${okMeta} migrated · tiktok_events: ${okTiktok} migrated.`);
  await pool.end();
}

main().catch((e) => {
  console.error('✗ failed:', e);
  process.exit(1);
});
