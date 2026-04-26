/**
 * Vérifie les variables minimales avant déploiement / après config Vercel.
 * Charge `.env.local` puis `.env` depuis `apps/web/` (sans dépendance npm).
 *
 * Usage : cd apps/web && node scripts/check-go-live.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const errors = [];
if (!process.env.DATABASE_URL?.trim()) errors.push('DATABASE_URL (Postgres + table dropship_products)');
if (!process.env.MEDUSA_URL?.trim()) errors.push('MEDUSA_URL');
const hasToken = !!process.env.MEDUSA_ADMIN_API_TOKEN?.trim();
const hasJwt =
  !!process.env.MEDUSA_ADMIN_EMAIL?.trim() && !!process.env.MEDUSA_ADMIN_PASSWORD?.trim();
if (!hasToken && !hasJwt) {
  errors.push('MEDUSA_ADMIN_API_TOKEN ou (MEDUSA_ADMIN_EMAIL + MEDUSA_ADMIN_PASSWORD)');
}

const warns = [];
if (!process.env.ALIEXPRESS_APP_KEY?.trim() || !process.env.ALIEXPRESS_APP_SECRET?.trim()) {
  warns.push('AliExpress : import désactivé tant que ALIEXPRESS_APP_KEY + ALIEXPRESS_APP_SECRET ne sont pas définis.');
}
if (!process.env.CJ_DROPSHIPPING_EMAIL?.trim() || !process.env.CJ_DROPSHIPPING_API_KEY?.trim()) {
  warns.push('CJ : import désactivé tant que CJ_DROPSHIPPING_EMAIL + CJ_DROPSHIPPING_API_KEY ne sont pas définis.');
}

if (errors.length) {
  console.error('[go-live] Variables manquantes :\n  - ' + errors.join('\n  - '));
  process.exit(1);
}

warns.forEach((w) => console.warn('[go-live] Avertissement :', w));
console.log('[go-live] Prérequis minimaux OK (DB + Medusa). Déploie sur Vercel/Railway avec les mêmes variables.');
