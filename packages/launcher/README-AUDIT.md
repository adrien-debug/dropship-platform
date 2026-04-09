# Audit du Système de Génération de Sites

## 📋 Fichiers d'Audit

- `audit.ts` - Script d'audit complet avec benchmarks
- `test-generation.ts` - Tests de génération et validation
- `test-visual-consistency.ts` - Tests de cohérence visuelle
- `audit-report.md` - Rapport automatique généré
- `AUDIT-FINAL.md` - Rapport détaillé avec recommandations

## 🚀 Commandes pour Reproduire l'Audit

### 1. Audit Complet (10min)

```bash
cd packages/launcher
npx tsx audit.ts
```

**Génère:**
- `audit-report.md` avec logs complets
- Benchmarks des 3 modes de génération
- Tests de connexion vLLM
- Analyse de tous les templates

**Durée:** ~10 minutes (à cause du test Full LLM)

---

### 2. Tests de Génération (4s)

```bash
npx tsx test-generation.ts
```

**Teste:**
- ✅ Template pur (0ms)
- ✅ Template + LLM (~3s)
- ✅ Tous les templates
- ✅ Validation complète

**Génère:** Dossier `test-output/` avec 24 pages générées

**Durée:** ~4 secondes

---

### 3. Tests de Cohérence Visuelle (1s)

```bash
npx tsx test-visual-consistency.ts
```

**Vérifie:**
- ✅ Cohérence des couleurs
- ✅ Cohérence des fonts
- ✅ Responsive classes
- ✅ Accessibilité (alt, aria)
- ✅ 'use client' dans contact
- ✅ getProducts dans home/shop

**Durée:** ~1 seconde

---

### 4. Test vLLM Direct

```bash
curl -X POST "http://100.88.191.49:8000/v1/chat/completions" \
  -H "Authorization: Bearer vllm-local-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-Coder-32B-Instruct-AWQ",
    "messages": [{"role": "user", "content": "Say hello in 3 words"}],
    "max_tokens": 50,
    "temperature": 0.1
  }'
```

**Résultat attendu:** `"Hello there!"` en ~1.7s

---

## 📊 Résultats de l'Audit

### ✅ Succès

1. **6 templates fonctionnels** - Anime, Luxury, Streetwear, Beauty, Tech, General
2. **100% taux de succès** - Templates purs et Template+LLM
3. **Performance excellente** - 0ms pour template pur, 3s pour template+LLM
4. **Code production-ready** - Imports corrects, responsive, accessible
5. **vLLM opérationnel** - http://100.88.191.49:8000

### ⚠️ Problèmes Trouvés

1. **Full LLM trop lent** - 8min avec 50% de timeouts
2. **API Key incohérente** - Code utilise `vllm-local-key`, doc dit `sk-vllm-local`
3. **Pas de fallback** - Échec total si vLLM down
4. **About/Contact non-responsive** - Manque classes sm:/md:/lg:

### 💡 Recommandations

1. **Utiliser `generateFromTemplateFast()`** - 3s vs 8min
2. **Implémenter fallback** - Template pur si LLM échoue
3. **Augmenter timeout** - 300s → 600s
4. **Ajouter responsive** - Classes sm:/md:/lg: dans about/contact
5. **Fixer API key** - Cohérence code/doc

---

## 🎯 Utilisation Recommandée

### Mode Production (Recommandé)

```typescript
import { generateFromTemplateFast } from '@dropship/launcher';

const config = {
  brandName: 'MyStore',
  tagline: '', // Sera généré par LLM
  niche: 'luxury watches',
  tone: 'premium',
  palette: 'dark',
  typography: 'modern',
  products: [...],
  pages: [],
};

const files = await generateFromTemplateFast(config, undefined, (step, detail) => {
  console.log(`[${step}] ${detail}`);
});

// ✅ 3s de génération
// ✅ 100% taux de succès
// ✅ Tagline personnalisé
// ✅ 4 pages (home, shop, about, contact)
```

---

### Mode Template Pur (Ultra-rapide)

```typescript
import { getTemplate, generateFromTemplate } from '@dropship/launcher';

const template = getTemplate('luxury');
const vars = {
  brandName: 'MyStore',
  tagline: 'Premium watches for everyone',
  niche: 'luxury watches',
  products: [...],
};

const files = generateFromTemplate(template, vars);

// ✅ 0ms de génération
// ✅ 100% taux de succès
// ✅ Pas d'appel LLM
// ✅ 4 pages
```

---

### Mode Full LLM (Déconseillé)

```typescript
import { generateFullSite } from '@dropship/launcher';

const files = await generateFullSite(config, onProgress);

// ❌ 8min de génération
// ⚠️ 50% taux de succès (timeouts)
// ❌ 9 appels LLM
// ⚠️ Seulement 2/4 pages générées
```

**Ne pas utiliser en production!**

---

## 📁 Structure des Fichiers Générés

```
files = Map {
  'src/app/page.tsx' => '...', // Home page (2,800 chars)
  'src/app/shop/page.tsx' => '...', // Shop page (1,300 chars)
  'src/app/about/page.tsx' => '...', // About page (1,200 chars)
  'src/app/contact/page.tsx' => '...', // Contact page (1,000 chars)
}
```

**Total:** ~6,300 chars par site

---

## 🔧 Variables d'Environnement

```bash
# vLLM (optionnel, utilise valeurs par défaut si absent)
VLLM_GPU1_URL=http://100.88.191.49:8000/v1
VLLM_API_KEY=vllm-local-key
VLLM_MODEL=Qwen/Qwen2.5-Coder-32B-Instruct-AWQ
```

---

## 📈 Métriques de Performance

| Métrique                  | Template Pur | Template+LLM | Full LLM  |
|---------------------------|--------------|--------------|-----------|
| Durée                     | 0ms          | ~3s          | ~8min     |
| Appels LLM                | 0            | 1            | 9         |
| Taux de succès            | 100%         | 100%         | 50%       |
| Pages générées            | 4/4          | 4/4          | 2/4       |
| Qualité code              | ⭐⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐       | ⭐⭐⭐⭐      |
| Personnalisation          | ⭐⭐⭐          | ⭐⭐⭐⭐⭐       | ⭐⭐⭐⭐⭐     |
| Recommandé production     | ✅           | ✅✅✅        | ❌        |

---

## 🐛 Bugs Connus

### 1. API Key Incohérente

**Fichier:** `src/llm.ts:2`  
**Code:** `const VLLM_API_KEY = process.env['VLLM_API_KEY'] || 'vllm-local-key';`  
**Doc:** Indique `sk-vllm-local`  
**Fix:** Utiliser `vllm-local-key` partout

---

### 2. Timeout Full LLM

**Fichier:** `src/llm.ts:19`  
**Code:** `signal: AbortSignal.timeout(300_000)` (5min)  
**Problème:** Timeout sur pages complexes  
**Fix:** Augmenter à 600s (10min)

---

### 3. About/Contact Non-Responsive

**Fichier:** `src/templates/shared.ts`  
**Problème:** Manque classes `sm:`, `md:`, `lg:`  
**Impact:** Layout cassé sur mobile  
**Fix:** Ajouter responsive classes

---

## 📞 Support

**vLLM URL:** http://100.88.191.49:8000  
**Health Check:** http://100.88.191.49:8000/health  
**Model:** Qwen/Qwen2.5-Coder-32B-Instruct-AWQ  
**API Key:** `vllm-local-key`

---

## 📝 Logs d'Exemple

### Template + LLM (Succès)

```
[template] Using template: Luxury (luxury)
[llm] Generating brand tagline...
[llm] Tagline: Timeless elegance, crafted for you.
[template] Generated 4 pages from template "Luxury"
✅ Generated 4 pages in 2854ms
```

---

### Full LLM (Timeout)

```
[context] Generating brand brief...
[context] Brief: ### Brand Brief: TestAnime...
[codegen] Generating 4 pages in parallel...
[copy] Writing copy for Home...
[copy] Writing copy for Shop...
[copy] Writing copy for About...
[copy] Writing copy for Contact...
[codegen] Generating Contact page code...
[codegen] Generating Shop page code...
[codegen] Generating About page code...
[codegen] Generating Home page code...
[error] Page generation failed: TimeoutError: The operation was aborted due to timeout
❌ 2/4 pages generated (Home & Contact timeout)
```

---

## ✅ Checklist de Validation

- [x] vLLM accessible et répond
- [x] 6 templates disponibles
- [x] Sélection automatique par niche fonctionne
- [x] Template pur génère 4 pages en 0ms
- [x] Template+LLM génère 4 pages en ~3s
- [x] Code généré valide (export default, imports)
- [x] Responsive (sauf about/contact)
- [x] Accessible (alt text, semantic HTML)
- [x] Cohérence visuelle entre pages
- [ ] Full LLM fiable (50% timeout)
- [ ] Fallback si vLLM down
- [ ] Cache taglines
- [ ] Tests unitaires

---

**Audit effectué:** 2026-04-08  
**Durée totale:** ~10 minutes  
**Tests:** 10 benchmarks + 4 validations  
**Résultat:** ✅ Système opérationnel (mode Template+LLM recommandé)
