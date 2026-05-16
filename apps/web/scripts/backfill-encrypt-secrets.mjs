#!/usr/bin/env node
// One-shot : backfill chiffrement AES-256-GCM des secrets historiques.
// Cible : platform_settings.aliexpress_* + dropship_stores.{meta_capi_token,
// tiktok_events_token, ga4_api_secret} où value/colonne plaintext est présente
// et value_enc est NULL.
//
// Idempotent : ne touche que les rows non chiffrées. Préserve la colonne
// plaintext en lecture seule (NULL après chiffrement). Lit STORE_SECRETS_KEY
// depuis .env.local.
//
// Usage : node scripts/backfill-encrypt-secrets.mjs

import { createCipheriv, randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import pg from 'pg';

config({ path: new URL('../.env.local', import.meta.url) });

const { Pool } = pg;
const ALGO = 'aes-256-gcm';
const NONCE_BYTES = 12;

const raw = process.env.STORE_SECRETS_KEY?.trim();
if (!raw) {
  console.error('STORE_SECRETS_KEY missing from .env.local');
  process.exit(1);
}
const key = Buffer.from(raw, 'base64');
if (key.length !== 32) {
  console.error(`STORE_SECRETS_KEY must be 32 bytes base64, got ${key.length}`);
  process.exit(1);
}

function encryptSecret(plaintext) {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted: Buffer.concat([enc, tag]), nonce };
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

let totalEncrypted = 0;

// --- platform_settings : aliexpress_* ---
console.log('\n=== platform_settings ===');
const { rows: psRows } = await pool.query(
  `SELECT key, value FROM platform_settings
   WHERE key LIKE 'aliexpress%' AND value IS NOT NULL AND value_enc IS NULL`,
);
console.log(`${psRows.length} rows to encrypt`);
for (const row of psRows) {
  if (row.key === 'aliexpress_token_expires' || row.key === 'aliexpress_user_nick') {
    // Non-secret metadata — skip encryption
    console.log(`  - ${row.key}: skipped (not a secret)`);
    continue;
  }
  const { encrypted, nonce } = encryptSecret(row.value);
  // value column is NOT NULL — keep plaintext untouched as a legacy fallback,
  // but populate value_enc + value_nonce so tryDecryptSecret() picks the
  // encrypted path first.
  await pool.query(
    `UPDATE platform_settings
     SET value_enc = $1, value_nonce = $2, updated_at = now()
     WHERE key = $3`,
    [encrypted, nonce, row.key],
  );
  console.log(`  + ${row.key}: encrypted (ciphertext=${encrypted.length}B, nonce=${nonce.length}B)`);
  totalEncrypted++;
}

// --- dropship_stores : per-store analytics tokens ---
console.log('\n=== dropship_stores ===');
const cols = [
  ['meta_capi_token', 'meta_capi_token_enc', 'meta_capi_token_nonce'],
  ['tiktok_events_token', 'tiktok_events_token_enc', 'tiktok_events_token_nonce'],
  ['ga4_api_secret', 'ga4_api_secret_enc', 'ga4_api_secret_nonce'],
];

for (const [plain, enc, nonce] of cols) {
  const { rows } = await pool.query(
    `SELECT id, ${plain} AS plaintext FROM dropship_stores
     WHERE ${plain} IS NOT NULL AND ${enc} IS NULL`,
  );
  console.log(`${plain}: ${rows.length} rows to encrypt`);
  for (const row of rows) {
    const { encrypted, nonce: nonceBuf } = encryptSecret(row.plaintext);
    // Keep plaintext column populated (some may be NOT NULL); store encrypted
    // copy alongside. A later cleanup migration can DROP the plaintext columns.
    await pool.query(
      `UPDATE dropship_stores
       SET ${enc} = $1, ${nonce} = $2, updated_at = now()
       WHERE id = $3`,
      [encrypted, nonceBuf, row.id],
    );
    totalEncrypted++;
  }
}

console.log(`\n✓ Backfill complete: ${totalEncrypted} secrets encrypted.\n`);

// Final state check
const { rows: finalCheck } = await pool.query(`
  SELECT key,
         value IS NOT NULL AS plain_still_present,
         value_enc IS NOT NULL AS encrypted
  FROM platform_settings WHERE key LIKE 'aliexpress%' ORDER BY key
`);
console.log('Final platform_settings state:');
console.table(finalCheck);

await pool.end();
