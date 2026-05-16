#!/usr/bin/env node
// One-shot : refresh AE access_token via le refresh_token actuel en DB.
// Lit DB directe, signe via HMAC-SHA256, écrit le nouveau token chiffré.
// Usage : node scripts/refresh-ae-token.mjs

import { createHmac } from 'node:crypto';
import { config } from 'dotenv';
import pg from 'pg';

config({ path: new URL('../.env.local', import.meta.url) });

const { Pool } = pg;
const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const REST_BASE = 'https://api-sg.aliexpress.com/rest';

if (!APP_KEY || !APP_SECRET) {
  console.error('Missing ALIEXPRESS_APP_KEY or ALIEXPRESS_APP_SECRET');
  process.exit(1);
}

function signSystem(apiPath, params) {
  const sorted = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== '' && params[k] != null)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join('');
  return createHmac('sha256', APP_SECRET).update(`${apiPath}${sorted}`, 'utf8').digest('hex').toUpperCase();
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

const { rows } = await pool.query(
  `SELECT key, value FROM platform_settings WHERE key = 'aliexpress_refresh_token'`,
);
if (!rows.length || !rows[0].value) {
  console.error('No refresh_token in DB');
  process.exit(1);
}
const refreshToken = rows[0].value;
console.log(`Refresh token: ${refreshToken.slice(0, 8)}...${refreshToken.slice(-4)} (${refreshToken.length} chars)`);

const apiPath = '/auth/token/refresh';
const params = {
  app_key: APP_KEY,
  refresh_token: refreshToken,
  sign_method: 'sha256',
  timestamp: Date.now().toString(),
};
params.sign = signSystem(apiPath, params);

console.log(`POST ${REST_BASE}${apiPath}`);
const res = await fetch(`${REST_BASE}${apiPath}?${new URLSearchParams(params)}`, {
  method: 'POST',
  signal: AbortSignal.timeout(15_000),
});
const rawBody = await res.text();
let data = {};
try { data = JSON.parse(rawBody); } catch {}

console.log(`HTTP ${res.status}`);
console.log('Response:', JSON.stringify(data, null, 2).slice(0, 800));

if (!data.access_token) {
  console.error('FAILED — no access_token returned');
  await pool.end();
  process.exit(1);
}

console.log(`\nNew access_token: ${data.access_token.slice(0, 8)}...${data.access_token.slice(-4)} (${data.access_token.length} chars)`);
console.log(`Expires: ${data.expire_time} (epoch ms = ${new Date(Number(data.expire_time)).toISOString()})`);
if (data.refresh_token) {
  console.log(`Rotated refresh_token: ${data.refresh_token.slice(0, 8)}...${data.refresh_token.slice(-4)}`);
}

// Persist new tokens (plaintext for now — backfill encryption is a separate step)
await pool.query(
  `INSERT INTO platform_settings (key, value, value_enc, value_nonce, updated_at) VALUES
     ('aliexpress_access_token', $1, NULL, NULL, now()),
     ('aliexpress_token_expires', $2, NULL, NULL, now())
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, value_enc = EXCLUDED.value_enc, value_nonce = EXCLUDED.value_nonce, updated_at = now()`,
  [data.access_token, data.expire_time?.toString() || ''],
);
if (data.refresh_token) {
  await pool.query(
    `INSERT INTO platform_settings (key, value, value_enc, value_nonce, updated_at) VALUES ('aliexpress_refresh_token', $1, NULL, NULL, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, value_enc = EXCLUDED.value_enc, value_nonce = EXCLUDED.value_nonce, updated_at = now()`,
    [data.refresh_token],
  );
}

console.log('\n✓ DB updated. Run backfill script next to encrypt these tokens.');
await pool.end();
