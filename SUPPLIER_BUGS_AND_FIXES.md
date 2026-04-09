# Bugs et Correctifs - Intégration Fournisseurs

**Date:** 8 avril 2026  
**Audit complet:** [SUPPLIER_AUDIT_REPORT.md](./SUPPLIER_AUDIT_REPORT.md)

---

## 🔴 Bugs Critiques

### 1. Recherche CJ Non Pertinente

**Fichier:** `packages/suppliers/src/cj.ts:69-95`

**Problème:**
```typescript
// Recherche "phone case" retourne des valises, outils de vélo, etc.
const data = await this.request(
  'GET',
  `/product/list?productNameEn=${encodeURIComponent(keyword)}&pageNum=1&pageSize=${pageSize}`,
);
```

**Cause:** L'endpoint `/product/list` ignore le paramètre `productNameEn` ou a une logique de recherche défaillante.

**Fix Proposé:**
```typescript
// Option 1: Utiliser l'endpoint v2 (si disponible)
const data = await this.request(
  'POST',
  '/product/search',
  {
    keyword,
    pageNum: 1,
    pageSize,
    sortBy: 'relevance', // Ajouter tri par pertinence
  }
);

// Option 2: Filtrer côté client
const products = data.list.filter(p => {
  const title = p.productNameEn.toLowerCase();
  const kw = keyword.toLowerCase();
  return title.includes(kw) || 
         title.split(' ').some(word => word.startsWith(kw));
});
```

**Impact:** Critique - Expérience utilisateur dégradée

---

### 2. AliExpress Signature Invalide

**Fichier:** `packages/suppliers/src/aliexpress.ts:11-14`

**Problème:**
```typescript
function sign(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params).sort();
  const baseString = sorted.map(k => k + params[k]).join('');
  return createHmac('sha256', secret).update(baseString).digest('hex').toUpperCase();
}
```

**Erreur API:**
```json
{
  "error_response": {
    "code": "IncompleteSignature",
    "msg": "The request signature does not conform to platform standards"
  }
}
```

**Cause:** Clés API invalides ou expirées (App Key: `531346`).

**Fix Proposé:**
1. Régénérer les clés sur https://portals.aliexpress.com
2. Vérifier que le compte Affiliate est actif
3. Tester avec le SDK officiel `ae_sdk` (npm)

```bash
# Installer le SDK officiel
npm install ae_sdk

# Tester
import AliExpress from 'ae_sdk';
const ae = new AliExpress(APP_KEY, APP_SECRET);
const products = await ae.searchProducts('phone case');
```

**Impact:** Critique - AliExpress complètement non fonctionnel

---

## 🟡 Bugs Importants

### 3. Images CJ en String JSON

**Fichier:** `packages/suppliers/src/cj.ts:146-180`

**Problème:**
```typescript
// getProduct() retourne parfois les images comme string JSON
{
  "imageUrls": "[\"https://...\",\"https://...\"]"
}
```

**Fix:**
```typescript
private mapProduct(raw: Record<string, unknown>): SupplierProduct {
  // Parse images si c'est un string JSON
  let imageUrls: string[] = [];
  const imageField = raw.productImage ?? raw.bigImage ?? '';
  
  if (typeof imageField === 'string') {
    if (imageField.startsWith('[')) {
      try {
        imageUrls = JSON.parse(imageField);
      } catch {
        imageUrls = [imageField];
      }
    } else {
      imageUrls = [imageField];
    }
  } else if (Array.isArray(imageField)) {
    imageUrls = imageField;
  }

  return {
    // ...
    imageUrls: imageUrls.filter(Boolean),
    // ...
  };
}
```

**Impact:** Mineur - Parsing possible côté client

---

### 4. Variants CJ Limités

**Fichier:** `packages/suppliers/src/cj.ts:148-162`

**Problème:**
```typescript
// La plupart des produits n'ont qu'un seul variant avec attributes vides
variants: [{
  sku: "CJGJ2823055",
  name: "Product Name",
  costCents: 2017,
  stock: 999,
  attributes: {} // ❌ Vide
}]
```

**Cause:** L'endpoint `/product/list` ne retourne pas les variants détaillés.

**Fix:**
```typescript
async getProductWithVariants(externalId: string): Promise<SupplierProduct | null> {
  // 1. Récupérer le produit
  const product = await this.getProduct(externalId);
  if (!product) return null;

  // 2. Récupérer les variants détaillés
  const variantsData = await this.request('GET', `/product/variant/list?pid=${externalId}`);
  
  // 3. Parser les variants avec attributs
  product.variants = variantsData.list.map(v => ({
    sku: v.variantSku,
    name: v.variantNameEn,
    costCents: Math.round(v.variantSellPrice * 100),
    stock: v.variantVolume,
    attributes: this.parseVariantAttributes(v), // Extraire couleur, taille, etc.
  }));

  return product;
}

private parseVariantAttributes(variant: Record<string, unknown>): Record<string, string> {
  const attrs: Record<string, string> = {};
  
  // Extraire les attributs depuis le nom ou les champs dédiés
  if (variant.color) attrs.color = String(variant.color);
  if (variant.size) attrs.size = String(variant.size);
  if (variant.material) attrs.material = String(variant.material);
  
  return attrs;
}
```

**Impact:** Important - Impossible de gérer les variantes (taille, couleur)

---

### 5. Rate Limits CJ Agressifs

**Fichier:** `packages/suppliers/src/cj.ts:90-92`

**Problème:**
```typescript
// Délai de 1.2s entre requêtes, mais 429 après 3-4 requêtes
if (keywords.indexOf(keyword) < keywords.length - 1) {
  await new Promise(r => setTimeout(r, 1200));
}
```

**Cause:** Rate limit CJ ~1 req/s, mais pas de retry sur 429.

**Fix:**
```typescript
private async requestWithRetry(
  method: string,
  path: string,
  body?: unknown,
  retries = 3
): Promise<unknown> {
  for (let i = 0; i < retries; i++) {
    try {
      return await this.request(method, path, body);
    } catch (err) {
      const is429 = err instanceof Error && err.message.includes('429');
      if (is429 && i < retries - 1) {
        // Backoff exponentiel: 2s, 4s, 8s
        const delay = Math.pow(2, i + 1) * 1000;
        console.warn(`[CJ] Rate limit hit, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries reached');
}
```

**Impact:** Important - Ralentit les syncs de catalogues

---

## 🟢 Améliorations Proposées

### 6. Implémenter un Cache Redis

**Fichier:** `packages/suppliers/src/cj.ts` (nouveau)

**Proposition:**
```typescript
import { createClient } from 'redis';

export class CJDropshippingClient implements SupplierClient {
  private redis?: ReturnType<typeof createClient>;

  constructor(config: CJConfig, redis?: ReturnType<typeof createClient>) {
    this.apiKey = config.apiKey;
    this.redis = redis;
  }

  async searchProducts(keywords: string[], options?: { limit?: number }): Promise<SupplierProduct[]> {
    const cacheKey = `cj:search:${keywords.join(',')}:${options?.limit ?? 20}`;
    
    // Vérifier le cache
    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        console.log('[CJ] Cache hit:', cacheKey);
        return JSON.parse(cached);
      }
    }

    // Recherche API
    const products = await this.searchProductsFromAPI(keywords, options);

    // Mettre en cache (1h)
    if (this.redis) {
      await this.redis.setEx(cacheKey, 3600, JSON.stringify(products));
    }

    return products;
  }
}
```

**Bénéfices:**
- Réduction de 80% des appels API
- Temps de réponse < 50ms pour les recherches cachées
- Moins de 429 errors

---

### 7. Ajouter des Logs Structurés

**Fichier:** `packages/suppliers/src/cj.ts` (tout le fichier)

**Proposition:**
```typescript
import { createLogger } from '@dropship/core';

const logger = createLogger('suppliers:cj');

export class CJDropshippingClient implements SupplierClient {
  async searchProducts(keywords: string[], options?: { limit?: number }): Promise<SupplierProduct[]> {
    const startTime = Date.now();
    
    try {
      logger.info('Searching products', { keywords, limit: options?.limit });
      const products = await this.searchProductsFromAPI(keywords, options);
      
      logger.info('Search completed', {
        keywords,
        count: products.length,
        duration: Date.now() - startTime,
      });
      
      return products;
    } catch (err) {
      logger.error('Search failed', {
        keywords,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - startTime,
      });
      throw err;
    }
  }
}
```

**Bénéfices:**
- Debugging facilité
- Métriques de performance
- Alertes automatiques sur erreurs

---

### 8. Améliorer la Pertinence de Recherche

**Fichier:** `packages/suppliers/src/cj.ts:69-95`

**Proposition:**
```typescript
async searchProducts(keywords: string[], options?: { limit?: number }): Promise<SupplierProduct[]> {
  const limit = options?.limit ?? 20;
  const all: SupplierProduct[] = [];

  for (const keyword of keywords) {
    if (all.length >= limit) break;
    const pageSize = Math.min(limit - all.length, 20);

    // Rechercher avec le keyword
    const data = await this.request(
      'GET',
      `/product/list?productNameEn=${encodeURIComponent(keyword)}&pageNum=1&pageSize=${pageSize * 2}`, // Fetch 2x pour filtrer
    ) as { list?: unknown[]; total?: number };

    if (data?.list) {
      // Filtrer par pertinence
      const products = data.list
        .map(p => this.mapProduct(p as Record<string, unknown>))
        .filter(p => this.isRelevant(p.name, keyword)) // ✅ Nouveau filtre
        .sort((a, b) => this.relevanceScore(b.name, keyword) - this.relevanceScore(a.name, keyword)) // ✅ Tri par score
        .slice(0, pageSize);
      
      all.push(...products);
    }

    if (keywords.indexOf(keyword) < keywords.length - 1) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }
  return all;
}

private isRelevant(title: string, keyword: string): boolean {
  const titleLower = title.toLowerCase();
  const keywordLower = keyword.toLowerCase();
  
  // Doit contenir au moins un mot du keyword
  const keywordWords = keywordLower.split(' ');
  return keywordWords.some(word => titleLower.includes(word));
}

private relevanceScore(title: string, keyword: string): number {
  const titleLower = title.toLowerCase();
  const keywordLower = keyword.toLowerCase();
  
  let score = 0;
  
  // +100 si le keyword exact est dans le titre
  if (titleLower.includes(keywordLower)) score += 100;
  
  // +10 par mot du keyword présent
  const keywordWords = keywordLower.split(' ');
  keywordWords.forEach(word => {
    if (titleLower.includes(word)) score += 10;
  });
  
  // -5 par mot du titre non pertinent
  const titleWords = titleLower.split(' ');
  const irrelevantWords = titleWords.filter(word => 
    !keywordWords.some(kw => word.includes(kw))
  );
  score -= irrelevantWords.length * 5;
  
  return score;
}
```

**Bénéfices:**
- Résultats plus pertinents
- Meilleure expérience utilisateur
- Moins de produits hors sujet

---

## 📋 Checklist de Correction

### Priorité 1 (Cette semaine)

- [ ] Fixer la recherche CJ (filtre de pertinence)
- [ ] Régénérer les clés AliExpress
- [ ] Fixer le parsing des images CJ
- [ ] Ajouter retry sur 429

### Priorité 2 (Semaine prochaine)

- [ ] Implémenter le cache Redis
- [ ] Améliorer les logs structurés
- [ ] Récupérer les variants CJ détaillés
- [ ] Tester AliExpress avec SDK officiel

### Priorité 3 (Mois prochain)

- [ ] Ajouter Spocket comme 3ème fournisseur
- [ ] Dashboard de monitoring
- [ ] Optimiser les images (Cloudinary)
- [ ] Traduire automatiquement les descriptions

---

## 🧪 Tests de Validation

Après chaque fix, exécuter:

```bash
# Tester CJ
npx tsx test-suppliers.ts

# Vérifier les logs
tail -f logs/suppliers.log

# Tester l'API admin
curl http://localhost:3200/api/trending?q=phone+case

# Tester un sync de catalogue
curl -X POST http://localhost:3200/api/catalogs/{id}/sync
```

---

## 📞 Support

Pour toute question:
- Slack: #dropship-tech
- Email: tech@hearst.ai
- Doc complète: [SUPPLIER_AUDIT_REPORT.md](./SUPPLIER_AUDIT_REPORT.md)
