# Guide de Test des Fournisseurs

Ce guide explique comment tester l'intégration des fournisseurs (CJ Dropshipping, AliExpress) en runtime.

---

## 🔑 Prérequis

### 1. Clés API

Les clés sont stockées dans `.env.local` sur GPU2:

```bash
# Récupérer les clés depuis GPU2
ssh comput3@100.110.74.114 "cat /home/comput3/dropship-platform/.env.local | grep -E '(CJ_|ALIEXPRESS_)'"
```

**Résultat attendu:**
```bash
CJ_DROPSHIPPING_API_KEY=CJ5297664@api@c083fec3800746a1912138123bfa1b34
ALIEXPRESS_APP_KEY=531346
ALIEXPRESS_APP_SECRET=M6FsH3rlsHGQRQ42KckZOVStm7WWT8Hz
```

### 2. Dépendances

```bash
npm install
```

---

## 🧪 Tests Automatisés

### Script de Test Complet

Créer `test-suppliers.ts` à la racine:

```typescript
#!/usr/bin/env tsx

import { CJDropshippingClient } from './packages/suppliers/src/cj';
import { AliExpressClient } from './packages/suppliers/src/aliexpress';
import { SupplierRouter } from './packages/suppliers/src/router';
import { writeFileSync } from 'fs';

const CJ_API_KEY = 'CJ5297664@api@c083fec3800746a1912138123bfa1b34';
const ALIEXPRESS_APP_KEY = '531346';
const ALIEXPRESS_APP_SECRET = 'M6FsH3rlsHGQRQ42KckZOVStm7WWT8Hz';

async function testCJ() {
  console.log('=== Testing CJ Dropshipping ===');
  const client = new CJDropshippingClient({ apiKey: CJ_API_KEY });

  // Test 1: Connection
  const connected = await client.testConnection();
  console.log('✓ Connection:', connected ? 'OK' : 'FAILED');

  // Test 2: Search
  const products = await client.searchProducts(['phone case'], { limit: 10 });
  console.log('✓ Search: Found', products.length, 'products');
  
  // Save first product
  if (products[0]) {
    writeFileSync('./cj-product-sample.json', JSON.stringify(products[0], null, 2));
  }

  // Test 3: Get product details
  if (products[0]) {
    const product = await client.getProduct(products[0].externalId);
    console.log('✓ Get product:', product ? 'OK' : 'NOT FOUND');
  }
}

async function testAliExpress() {
  console.log('\n=== Testing AliExpress ===');
  const client = new AliExpressClient({
    appKey: ALIEXPRESS_APP_KEY,
    appSecret: ALIEXPRESS_APP_SECRET,
  });

  try {
    const connected = await client.testConnection();
    console.log('✓ Connection:', connected ? 'OK' : 'FAILED');

    const products = await client.searchProducts(['phone case'], { limit: 10 });
    console.log('✓ Search: Found', products.length, 'products');
  } catch (err) {
    console.error('✗ Error:', err instanceof Error ? err.message : err);
  }
}

async function testRouter() {
  console.log('\n=== Testing SupplierRouter ===');
  const cj = new CJDropshippingClient({ apiKey: CJ_API_KEY });
  const ae = new AliExpressClient({
    appKey: ALIEXPRESS_APP_KEY,
    appSecret: ALIEXPRESS_APP_SECRET,
  });
  
  const router = new SupplierRouter(cj, ae);
  const products = await router.search({ keywords: 'phone case', limit: 20 });
  
  console.log('✓ Multi-search:', products.length, 'products');
  console.log('  - CJ:', products.filter(p => p.supplier === 'cjdropshipping').length);
  console.log('  - AE:', products.filter(p => p.supplier === 'aliexpress').length);
  
  writeFileSync('./router-products.json', JSON.stringify(products, null, 2));
}

async function main() {
  try {
    await testCJ();
    await testAliExpress();
    await testRouter();
    console.log('\n✅ All tests completed');
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

main();
```

### Exécuter les Tests

```bash
npx tsx test-suppliers.ts
```

**Résultat attendu:**
```
=== Testing CJ Dropshipping ===
✓ Connection: OK
✓ Search: Found 10 products
✓ Get product: OK

=== Testing AliExpress ===
✗ Error: AliExpress API error: IncompleteSignature - The request signature does not conform to platform standards

=== Testing SupplierRouter ===
✓ Multi-search: 20 products
  - CJ: 20
  - AE: 0

✅ All tests completed
```

---

## 🔍 Tests Manuels

### 1. Tester CJ Authentication

```bash
curl -X POST https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"CJ5297664@api@c083fec3800746a1912138123bfa1b34"}'
```

**Résultat attendu:**
```json
{
  "code": 200,
  "result": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "...",
    "accessTokenExpiryDate": "2026-04-22T..."
  }
}
```

### 2. Tester CJ Search

```bash
# 1. Obtenir le token
TOKEN=$(curl -s -X POST https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"CJ5297664@api@c083fec3800746a1912138123bfa1b34"}' \
  | jq -r '.data.accessToken')

# 2. Rechercher des produits
curl -X GET "https://developers.cjdropshipping.com/api2.0/v1/product/list?productNameEn=phone%20case&pageNum=1&pageSize=5" \
  -H "Content-Type: application/json" \
  -H "CJ-Access-Token: $TOKEN"
```

### 3. Tester AliExpress

```bash
# Créer un script Node.js pour générer la signature
node -e "
const crypto = require('crypto');
const params = {
  app_key: '531346',
  method: 'aliexpress.affiliate.product.query',
  timestamp: String(Date.now()),
  v: '2.0',
  format: 'json',
  simplify: 'true',
  keywords: 'phone',
  target_currency: 'EUR',
  target_language: 'EN',
  page_no: '1',
  page_size: '5',
  sign_method: 'sha256',
};

const sorted = Object.keys(params).sort();
const baseString = sorted.map(k => k + params[k]).join('');
const signature = crypto.createHmac('sha256', 'M6FsH3rlsHGQRQ42KckZOVStm7WWT8Hz')
  .update(baseString)
  .digest('hex')
  .toUpperCase();

params.sign = signature;
const qs = new URLSearchParams(params).toString();
console.log('https://api-sg.aliexpress.com/sync?' + qs);
"
```

Copier l'URL et tester:
```bash
curl -X POST "<URL_GENEREE>"
```

---

## 🌐 Tester les Routes API Admin

### 1. Route `/api/trending`

```bash
# Local
curl http://localhost:3200/api/trending?q=phone+case

# Production (via tunnel)
curl https://admin.hearst.app/api/trending?q=phone+case
```

**Résultat attendu:**
```json
{
  "products": [
    {
      "title": "Anti-Spy Double-Sided Glass Phone Case",
      "price": 7.62,
      "sell_price": 7.62,
      "supplier": "CJ Dropshipping",
      "category": "Home Office Storage",
      "trend_score": 85,
      "source": "CJ Dropshipping",
      "shipping_days": "15-30j",
      "image": "https://oss-cf.cjdropshipping.com/..."
    }
  ],
  "query": "phone case",
  "sources": [
    { "name": "CJ Dropshipping", "url": "https://cjdropshipping.com" }
  ],
  "timestamp": "2026-04-08T..."
}
```

### 2. Route `/api/catalogs/[id]/sync`

```bash
# 1. Créer un catalog de test dans Supabase
# 2. Lancer le sync
curl -X POST http://localhost:3200/api/catalogs/{CATALOG_ID}/sync
```

**Résultat attendu:**
```json
{
  "success": true,
  "catalog_id": "uuid",
  "products_found": 50,
  "products_added": 48,
  "last_sync_at": "2026-04-08T...",
  "duration_ms": 12500
}
```

---

## 📊 Vérifier les Données dans Supabase

### 1. Vérifier les Produits Importés

```sql
-- Voir les derniers produits importés
SELECT 
  id,
  name,
  supplier,
  cost_cents,
  price_cents,
  category,
  synced_at
FROM products
WHERE supplier = 'cjdropshipping'
ORDER BY synced_at DESC
LIMIT 10;
```

### 2. Vérifier les Logs de Sync

```sql
-- Voir les derniers syncs
SELECT 
  catalog_id,
  status,
  products_found,
  products_added,
  error,
  duration_ms,
  created_at
FROM sync_logs
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🐛 Debugging

### Activer les Logs Détaillés

Dans `packages/suppliers/src/cj.ts`:

```typescript
private async request(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = await this.authenticate();
  
  console.log('[CJ] Request:', method, path); // ✅ Ajouter
  console.log('[CJ] Body:', body); // ✅ Ajouter
  
  const res = await fetch(`${this.baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  console.log('[CJ] Status:', res.status); // ✅ Ajouter
  
  if (!res.ok) throw new Error(`CJ API error: ${res.status} ${res.statusText}`);
  
  const json = (await res.json()) as { code: number; message?: string; data: unknown };
  
  console.log('[CJ] Response:', json); // ✅ Ajouter
  
  if (json.code !== 200) throw new Error(`CJ API error: ${json.message}`);
  return json.data;
}
```

### Capturer les Erreurs API

```bash
# Rediriger les logs vers un fichier
npx tsx test-suppliers.ts 2>&1 | tee supplier-test.log

# Filtrer les erreurs
grep -i "error\|failed" supplier-test.log
```

---

## 📝 Checklist de Test

Avant de déployer en production:

- [ ] CJ authentication fonctionne
- [ ] CJ search retourne des produits
- [ ] CJ getProduct retourne les détails
- [ ] Rate limits CJ respectés (1 req/s)
- [ ] AliExpress authentication fonctionne (ou désactivé)
- [ ] SupplierRouter agrège correctement
- [ ] Route `/api/trending` retourne des produits
- [ ] Route `/api/catalogs/[id]/sync` importe dans Supabase
- [ ] Logs d'erreur visibles dans Supabase
- [ ] Pas de secrets exposés dans les logs

---

## 🔄 Régénérer les Clés AliExpress

Si AliExpress ne fonctionne pas:

1. Aller sur https://portals.aliexpress.com
2. Se connecter avec le compte Affiliate
3. Aller dans "My Apps" > "Create App"
4. Copier `App Key` et `App Secret`
5. Créer un nouveau "Tracking ID" dans "Links" > "Tracking ID"
6. Mettre à jour `.env.local`:
```bash
ALIEXPRESS_APP_KEY=<nouveau_app_key>
ALIEXPRESS_APP_SECRET=<nouveau_app_secret>
```
7. Redémarrer l'admin: `pm2 restart admin`
8. Tester: `npx tsx test-suppliers.ts`

---

## 📞 Support

Si les tests échouent:
- Vérifier les clés API dans `.env.local`
- Vérifier les logs: `tail -f logs/suppliers.log`
- Vérifier Supabase: `sync_logs` table
- Slack: #dropship-tech
- Email: tech@hearst.ai
