# Dropship Platform

Multi-site dropshipping platform — Turborepo monorepo.

## Architecture

```
GPU2 (100.110.74.114 / public: 86.97.162.62)
├── Storefronts (Next.js Docker)
│   ├── onepeace-storefront     :3100
│   ├── anime-figures           :3101
│   ├── anime-figurines-fr      :3103
│   └── 2piece+ (à créer)       :TBD
├── Medusa v2 API               :9000
├── OpenClaw Dropship (Express) :3849
├── Postgres 17                 :5433
├── Redis 7
├── Coolify (Traefik)           :8000
└── vLLM (fast / coding / embeddings)

GPU1 (100.88.191.49)
├── vLLM Qwen2.5-Coder-32B    :8000
├── vLLM Qwen2.5-Coder-7B     :8001
├── vLLM nomic-embed-text      :8002
├── vLLM DeepSeek-R1-70B       :8003
└── ComfyUI                    :8188

Supabase (managed)
└── products, sites, catalogs, campaigns, sync_logs
```

## Monorepo

```
apps/
  admin/              Next.js admin dashboard (:3200 local)
  storefront/         Next.js storefront template (deployed via Docker on GPU2)
  medusa/             Medusa v2 config
  openclaw-dropship/  Express API — dropshipping orchestration

packages/
  core/               Shared types & DTOs
  ui/                 Shared React components
  suppliers/          CJ Dropshipping, Shopify, AliExpress
  ai/                 vLLM + ComfyUI
  design-systems/     10 design systems
  marketing/          Google Ads & Meta
  deploy/             Deploy utilities

prompts/
  agent-shop-creator.md         Shop creation agent (9-step pipeline)
  agent-supplier-research.md    Supplier audit agent (20 suppliers scoring)

scripts/
  deploy-storefront.sh          Deploy storefront on GPU2
  sync-products-to-medusa.ts    Sync Supabase → Medusa
```

## Public URLs (Cloudflare Tunnel)

| Service | URL publique |
|---------|-------------|
| Admin Dashboard | https://logic-recognised-vcr-jill.trycloudflare.com |
| Storefront | https://piece-occupational-mother-highlight.trycloudflare.com |
| Medusa API | https://wheels-limits-industries-screen.trycloudflare.com |
| OpenClaw Dropship | https://territories-treasure-emphasis-merchants.trycloudflare.com |

> Quick tunnels — URLs temporaires, changent au redémarrage. Migrer vers un named tunnel + domaine custom pour la prod.

## Services

| Service | Host | Port | Status |
|---------|------|------|--------|
| Medusa v2 API | GPU2 | 9000 | LIVE |
| OpenClaw Dropship | GPU2 | 3849 | LIVE |
| Storefront OnePeace | GPU2 | 3100 | LIVE |
| Storefront Anime | GPU2 | 3101 | LIVE |
| Storefront Figurines FR | GPU2 | 3103 | LIVE |
| Storefront 2piece+ | GPU2 | TBD | PENDING |
| Postgres 17 | GPU2 | 5433 | LIVE |
| Redis 7 | GPU2 | — | LIVE |
| Coolify | GPU2 | 8000 | LIVE |
| Admin Dashboard | GPU2 | 3200 | LIVE |
| Supabase | managed | — | LIVE |

## OpenClaw Dropship API

Express backend sur GPU2:3849.

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check (medusa, cj, supabase) |
| `GET /products/search?q=...&supplier=cj\|medusa\|all` | Recherche produits fournisseurs |
| `POST /shop/create` | Pipeline création boutique |
| `POST /shop/execute` | Exécuter pipeline complet (sales channel + produits + deploy) |
| `POST /agent/pipeline` | **Pipeline A-Z** (SSE) — mots-clés → site live + marketing |
| `GET /agent/status` | Status agent + tools disponibles |

### Input Normalization

La pipeline accepte maintenant des inputs utilisateur flexibles :

**Keywords :**
- Phrases complètes : `"je veux vendre des sacs de luxe pour femmes"` → `["bags", "luxury", "women"]`
- Typos simples : `"chausure"` → `"shoes"`
- Filler words supprimés : `"hey jveu des trucs gaming"` → `["gaming"]`

**Market :**
- `"france"`, `"fr"`, `"français"` → `FR`
- `"europe"`, `"eu"` → `EU`
- `"usa"`, `"us"`, `"america"` → `US`

**Positioning :**
- `"pas cher"`, `"cheap"`, `"budget"` → `budget`
- `"milieu de gamme"`, `"standard"`, `"mid"` → `mid`
- `"luxe"`, `"luxury"`, `"premium"` → `premium`

## Agent Pipeline A-Z — OpenCore

Pipeline autonome : 2 mots-clés → site e-commerce complet prêt à vendre.

**Architecture OpenCore (v2) :**
- `withRetry()` : retry avec backoff exponentiel sur tous les appels externes (CJ, vLLM, launcher)
- `extractJSON()` : extraction JSON robuste (parse direct → code blocks markdown → regex `{...}`)
- Fallback content statique si le LLM échoue après tous les retries
- Health check polling (5 tentatives × 3s) après déploiement
- Auth middleware `x-api-key` sur `/agent` et `/shop`

**Étapes automatisées :**
1. Validation & normalisation input (fail-fast)
2. Recherche produits CJ avec retry (2 tentatives)
3. Génération contenu IA + enrichissement produits (parallèle, retry 3× sur LLM)
4. Création boutique via launcher (timeout 600s, SSE stream)
5. Health check polling du site déployé
6. Audit SEO (conditionné au health check)
7. Plans marketing (Google Ads + Meta Ads)
8. Sauvegarde Supabase (campaigns)

**Tools (8) :** `search_products`, `enrich_products`, `generate_site_content`, `create_shop`, `check_health`, `create_google_ads_campaign`, `create_meta_ads_campaign`, `run_seo_audit`

**Modes :**
- `fast` (défaut) : pipeline déterministe OpenCore, ~6 min
- `agent` : orchestration LLM avec function calling (Qwen 32B), retry par itération, 3 erreurs consécutives max

**Résilience OpenCore :**
- **Retry LLM** : `jsonCompletion` 3 tentatives (backoff 1.5s → 3s → 6s), `textCompletion` 2 tentatives
- **Extraction JSON** : gère les réponses Qwen wrapped dans ` ```json ... ``` ` ou avec du texte autour
- **Fallback content** : si `generateSiteContent` échoue → contenu statique généré depuis la niche
- **Fallback produits** : si l'enrichissement échoue → données brutes CJ avec prix ×2.5
- **Health polling** : 5 checks × 3s avant de déclarer le site up/down
- **Orchestrator** : erreurs consécutives trackées (pas total), break après 3 consécutives

**Optimisations :**
- Normalisation d'input : phrases utilisateur → keywords, typos corrigées, market/positioning variants
- Enrichissement produits : parallèle par batch de 5
- Logs structurés `[opencore:*]` avec elapsed time

## Agents

| Agent | Fichier / Endpoint | Rôle |
|-------|---------|------|
| **Pipeline A-Z** (exécutable) | `/agent/pipeline` (SSE) + `/agents` page | 2 mots-clés → site live + marketing — **EXÉCUTE** réellement les actions |
| **Assistant Draft** (chat) | `/agents` page + `/api/agents/chat` | Chat LLM (Qwen 7B/32B) en mode **draft-only** — rédige plans et stratégies, **N'EXÉCUTE PAS** d'actions |
| Content Writer | `agent/content-writer.ts` | Brand identity, hero, about, policies, SEO meta, product descriptions |
| Shop Creator | `prompts/agent-shop-creator.md` | Création de boutique end-to-end |
| Supplier Research | `prompts/agent-supplier-research.md` | Audit et scoring de fournisseurs |

### Pipeline vs Assistant Draft

**Pipeline A-Z** (`/agent/pipeline`) :
- Mode exécutable : crée réellement shops, produits, campagnes
- SSE streaming avec events runtime
- Chemin critique produit

**Assistant Draft** (`/api/agents/chat`) :
- Mode draft-only : rédige plans, propose stratégies
- Ne peut pas exécuter d'actions, créer de shop, lancer de pub
- Redirige vers Pipeline A-Z pour exécution réelle
- Utile pour cadrage, brainstorming, clarification besoins

### vLLM Models (GPU1)

| Port | Model | Usage |
|------|-------|-------|
| 8000 | Qwen2.5-Coder-32B-AWQ | Main (puissant) |
| 8001 | Qwen2.5-Coder-7B-AWQ | Fast (rapide) |
| 8002 | nomic-embed-text-v1.5 | Embeddings |
| 8003 | DeepSeek-R1-70B-AWQ | Reasoning |

## Deploy Storefront

```bash
./scripts/deploy-storefront.sh <slug> <port> [sales-channel-id]
```

## Environment

Copier `.env.example` → `.env.local` et renseigner :
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `CJ_DROPSHIPPING_API_KEY`
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `COOLIFY_URL`, `COOLIFY_TOKEN`

## Quick Start

```bash
npm install
npm run dev          # Admin (:3200) + Storefront (:3001)
npm run build
npm run type-check
```

## Latest Changes (2026-04-05)

**AliExpress Catalog + Stripe Checkout :**

1. **Catalogue AliExpress** (`apps/storefront/src/data/aliexpress-catalog.ts`) : 515+ produits One Piece (dont extension 2026-04-05 : fruits du demon, maquettes, montres, drapeaux, TCG, coques AirPods, sneakers, gourdes, building blocks, figurines par perso, vestes, rideaux, goodies). 18 avec images CDN réelles, reste `imageUrls` vide en attente scrape. Script de scrape batch inclus (`scrape-images.mjs`).
2. **API Produits** (`apps/storefront/src/app/api/products/route.ts`) : source AliExpress, 20 catégories, filtres catégorie/prix/recherche, tri, pagination
3. **Stripe Checkout** (`apps/storefront/src/app/api/checkout/route.ts`) : session Stripe live, collecte adresse livraison (10 pays), promo codes en metadata
4. **Pages storefront** : `/checkout`, `/checkout/success`, `/about`, `/contact` — toutes fonctionnelles (200 OK)
5. **Shop home** (`apps/storefront/src/data/shop-home-data.ts`) : featured products et new arrivals générés dynamiquement depuis le catalogue AliExpress

**OpenCore Pipeline Rebuild :**

1. **`content-writer.ts`** : `extractJSON()` robuste (parse → markdown → regex), `withRetry()` backoff exponentiel, retry 3× sur JSON / 2× sur text
2. **`fast-pipeline.ts`** : `ADMIN_URL` env var (plus localhost hardcodé), timeout 600s, health polling, fallback content statique, retry CJ, logs `[opencore:*]`
3. **`orchestrator.ts`** : retry LLM par itération, erreurs consécutives trackées (plus total), `extractJSON` pour inline tool calls
4. **`server.ts`** : auth middleware `x-api-key` sur `/agent` et `/shop` (`OPENCLAW_API_KEY` env)
5. **`medusa-client.ts`** : credentials hardcodées supprimées (env-only)
6. **`tools.ts`** : dead code supprimé, timeout 600s, intégration AliExpress client

**Pipeline `/sites/new` avec génération AI complète :**

1. **`/api/shops/setup`** : crée sales channel + publishable key Medusa, source automatiquement CJ avec filtrage intelligent, importe les produits en Medusa, puis crée `sites` + `catalogs` en base.
2. **`/api/launcher/stream`** : **NOUVEAU** utilise maintenant le vrai codegen AI via `@dropship/launcher`:
   - **GPU1 Qwen2.5-Coder-32B** génère le brand brief, copywriting et code JSX/TSX des pages
   - **ComfyUI** (si disponible) pour logo + hero images, sinon fallback SVG
   - Génération de 4 pages complètes (Home, Shop, About, Contact) avec contenu unique par niche
   - Build le projet et le déploie sur GPU2
3. **Wizard `/sites/new`** : passe `siteId`, `publishableKey`, `regionId`, `salesChannelId` et `importedProducts` au stream, et considère `pipeline:done` comme succès réel.
4. **Design systems** : auto-suggestion basée sur l'audience (ex: "anime figurines" → ds-02 Neo Tokyo), avec 15 thèmes disponibles.

## Design Systems

15 thèmes dans `packages/design-systems/` :

| ID | Nom | Catégorie | Audience |
|----|-----|-----------|----------|
| swiss | Swiss Tech Master | tech | tech, saas, agency |
| cyber | Cyber | tech | gaming, crypto |
| avant | Avant | art | art, fashion |
| radical | Radical | fashion | streetwear, bold |
| chrome | Chrome | luxury | premium, luxury |
| ds-01 | Minimal White | lifestyle | mode, beauté, premium |
| ds-02 | Neo Tokyo | gaming | anime, gaming, manga |
| ds-03 | Earth Organic | wellness | bio, santé, naturel |
| ds-04 | Bold Pop | fun | enfants, jouets, gadgets |
| ds-05 | Classic Commerce | ecommerce | général, marketplace |
| ds-06 | Luxury Gold | luxury | bijoux, montres, luxe |
| ds-07 | Sport Energy | sport | fitness, outdoor, sport |
| ds-08 | Pastel Bloom | beauty | beauté, skincare, mode |
| ds-09 | Tech Dark | tech | electronics, gadgets |
| ds-10 | Streetwear | fashion | streetwear, sneakers, urban |

### Auto-suggestion & Options Avancées

**Auto-suggestion par audience**: Le système suggère automatiquement les design systems selon la niche (ex: "anime figurines" → ds-02 Neo Tokyo).

**Options avancées du wizard** (étape 4):
- **Tagline personnalisé** → sinon généré par l'IA
- **Ton éditorial** → friendly, professional, sophisticated, playful, bold
- **Couleurs custom** → override accent/bg/text du design system
- **Sites de référence** → URLs pour inspirer style et contenu
- **Pages à générer** → home, shop, about, contact, blog, faq, shipping, returns
- **Nombre de produits** → 4 à 50 produits CJ

## Launcher (Project Generator)

Next.js site generator with live logs and GPU2 deploy.

| Step | What it does | Status |
|------|-------------|--------|
| 1. Setup | Sales channel + publishable key + CJ sourcing + Medusa import + Supabase site/catalog | ✅ PASS |
| 2. Scaffold | Creates project dir, package.json, tsconfig, theme, layout, `medusa.ts` | ✅ PASS |
| 3. Assets | ComfyUI logo generation (fallback SVG) + hero image from products | ✅ PASS |
| 4. Integrations | Medusa + Stripe envs + site config wiring | ✅ PASS |
| 5. Codegen | **AI-powered**: GPU1 Qwen2.5-Coder-32B generates brand brief, copy, and 4 pages (fallback templates if GPU offline) | ✅ PASS |
| 6. Install | `npm install` in generated project | ✅ PASS |
| 7. Build Check | `npx next build` — **fails fast if build errors** (no auto-retry loop) | ✅ PASS |
| 8. Launch | Start dev server for validation | ✅ PASS |
| 9. Deploy | Sync on GPU2 + `next start` + healthcheck | ✅ PASS |

### Build Strategy

**Fail-fast approach** : Si le build échoue après codegen, la pipeline s'arrête proprement au lieu de tenter une boucle de debug infinie.

**Rationale** :
- Le codegen AI (Qwen 32B) génère du code compilable ~95% du temps
- Si GPU offline, fallback sur templates statiques garantis compilables
- `debug-fix` (boucle AI de 5 tentatives) retiré du chemin critique car :
  - Brûle du temps sans garantie de convergence
  - Masque les vrais problèmes de codegen
  - Crée des faux succès avec code de qualité dégradée

**Si build échoue** :
- Échec propre avec step `build-check` en erreur
- Logs clairs sur la cause de l'échec
- Pas de faux succès ni de boucle opaque

### Pending Work (handoff)

**Done:**
- [x] `/sites/new` → `/api/shops/setup` → `/api/launcher/stream` → GPU2 live storefront
- [x] CJ sourcing + Medusa import automated before storefront build
- [x] Generated pages typed correctly and linked to live Medusa products
- [x] Theme selection applied in generated storefront CSS/layout

**Still to improve:**
- [ ] Product relevance for trademark-heavy niches is heuristic and still needs a smarter supplier-ranking layer
- [ ] `/api/launcher/stream` and `test-step` should share more code
- [ ] `apps/storefront` old template path still diverges from launcher-generated storefronts
- [x] Stripe checkout flow in storefront — live, testé end-to-end
- [ ] Marketing package (`packages/marketing/`) has Google Ads + Meta Ads clients — need API keys + real test

**NICE TO HAVE:**
- [ ] Named Cloudflare Tunnel (current quick tunnels change on restart)
- [ ] Supabase RLS policies on `sites`, `catalogs`, `campaigns` tables
- [ ] CI/CD pipeline (GitHub Actions for build + type-check)
- [ ] Product page (`/product/[handle]`) in generated sites
- [ ] Cart + checkout flow in generated sites
- [ ] SEO audit agent integration with launcher
- [ ] Marketing agent auto-creates campaigns after deploy

## Env Vars

Required in `.env` / `.env.local`:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `CJ_DROPSHIPPING_API_KEY`
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `MEDUSA_PUBLISHABLE_KEY`, `MEDUSA_ADMIN_EMAIL`, `MEDUSA_ADMIN_PASSWORD`
- `OPENCLAW_API_KEY` (auth middleware — si absent, routes ouvertes)
- `ADMIN_URL` (default: `http://{GPU2_HOST}:3200`)
- `VLLM_GPU1_URL` (default: `http://100.88.191.49:8000/v1`)
- `VLLM_API_KEY` (default: `vllm-local-key`)
- `COOLIFY_URL`, `COOLIFY_TOKEN`
- `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET` (AliExpress Open Platform — OAuth token requis pour DS API)
- `GOOGLE_ADS_*`, `META_ACCESS_TOKEN` (for marketing)

## Notes

- GPU2 : tous les containers Docker en `--network host` (workaround kernel bug bridge veth).
- Accès public via Cloudflare Quick Tunnels (cloudflared). Voir section "Public URLs".
- Launcher page: `http://localhost:3200/launcher` — test each step or run full pipeline with live SSE logs.
