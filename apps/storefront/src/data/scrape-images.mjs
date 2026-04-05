#!/usr/bin/env node
/**
 * Scrape og:image from AliExpress for all products without images.
 * Usage: node apps/storefront/src/data/scrape-images.mjs
 * 
 * Will output lines like: ae-1234567890|https://ae01.alicdn.com/kf/...
 * Copy working lines into aliexpress-catalog.ts imageUrls.
 *
 * Tips:
 *  - Use a VPN if AliExpress blocks your IP
 *  - Adjust DELAY_MS if rate-limited (try 3000-5000)
 */
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DELAY_MS = 2000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, 'aliexpress-catalog.ts');

function extractIds() {
  const content = fs.readFileSync(catalogPath, 'utf8');
  const entries = [];
  const re = /id:\s*'(ae-\d+)'[\s\S]*?imageUrls:\s*\['([^']*)'\]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const id = m[1];
    const img = m[2];
    if (!img || img === '') {
      const aeId = id.replace('ae-', '');
      entries.push({ id, aeId });
    }
  }
  return entries;
}

function fetchOgImage(aeId) {
  return new Promise((resolve) => {
    const url = `https://www.aliexpress.com/item/${aeId}.html`;
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; if (data.length > 80000) res.destroy(); });
      res.on('end', () => {
        const m = data.match(/og:image[^>]*content="([^"]+)"/);
        if (m && m[1].includes('alicdn')) resolve(m[1]);
        else resolve(null);
      });
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

async function main() {
  const entries = extractIds();
  console.log(`Found ${entries.length} products without images.`);
  
  let found = 0;
  let failed = 0;
  
  for (let i = 0; i < entries.length; i++) {
    const { id, aeId } = entries[i];
    const img = await fetchOgImage(aeId);
    if (img) {
      console.log(`${id}|${img}`);
      found++;
    } else {
      console.error(`MISS: ${id}`);
      failed++;
    }
    if (i < entries.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    if ((i + 1) % 10 === 0) {
      console.error(`Progress: ${i + 1}/${entries.length} (found: ${found}, missed: ${failed})`);
    }
  }
  
  console.error(`\nDone. Found: ${found}, Missed: ${failed}`);
}

main();
