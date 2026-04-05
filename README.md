# Dropship Platform

Multi-site dropshipping platform — Turborepo monorepo.

## Architecture

```
GPU2 (100.110.74.114 / public: 86.97.162.62)
├── Storefronts (Next.js Docker)
│   ├── onepeace-storefront     :3100
│   ├── anime-figures           :3101
│   └── anime-figurines-fr      :3103
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

## Agent Pipeline A-Z

Pipeline autonome : 2 mots-clés → site e-commerce complet prêt à vendre.

**Étapes automatisées :**
1. Recherche produits (CJ Dropshipping)
2. Génération contenu IA (brand, hero, about, policies, SEO)
3. Enrichissement produits (descriptions + meta SEO par produit)
4. Création boutique (Medusa sales channel + produits + Docker deploy)
5. Audit SEO du site déployé
6. Plans marketing (Google Ads + Meta Ads)

**Tools (8) :** `search_products`, `enrich_products`, `generate_site_content`, `create_shop`, `check_health`, `create_google_ads_campaign`, `create_meta_ads_campaign`, `run_seo_audit`

**Modes :**
- `fast` (défaut) : pipeline déterministe, ~6 min
- `agent` : orchestration LLM avec function calling (Qwen 32B + hermes parser)

## Agents

| Agent | Fichier / Endpoint | Rôle |
|-------|---------|------|
| Pipeline A-Z | `/agent/pipeline` (SSE) + `/agents` page | 2 mots-clés → site live + marketing |
| Agent IA (chat) | `/agents` page + `/api/agents/chat` | Chat LLM (Qwen 7B/32B) pour piloter la plateforme |
| Content Writer | `agent/content-writer.ts` | Brand identity, hero, about, policies, SEO meta, product descriptions |
| Shop Creator | `prompts/agent-shop-creator.md` | Création de boutique end-to-end |
| Supplier Research | `prompts/agent-supplier-research.md` | Audit et scoring de fournisseurs |

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

## Design Systems

10 thèmes dans `packages/design-systems/` :

| ID | Nom |
|----|-----|
| ds-01 | Minimal White |
| ds-02 | Neo Tokyo |
| ds-03 | Earth Organic |
| ds-04 | Bold Pop |
| ds-05 | Classic Commerce |
| ds-06 | Luxury Gold |
| ds-07 | Sport Energy |
| ds-08 | Pastel Bloom |
| ds-09 | Tech Dark |
| ds-10 | Streetwear |

## Notes

- GPU2 : tous les containers Docker en `--network host` (workaround kernel bug bridge veth).
- Accès public via Cloudflare Quick Tunnels (cloudflared). Voir section "Public URLs".
