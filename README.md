# Dropship Platform

Multi-site dropshipping platform built with Turborepo monorepo.

## Architecture

```
GPU1 (100.88.191.49)          GPU2 (100.110.74.114)
├── vLLM Qwen 32B (:8000)    ├── Storefront OnePeace (:3100)
├── vLLM Qwen 7B (:8001)     ├── Storefront Anime (:3101)
├── ComfyUI (:8188)           ├── Medusa v2 API (:9000)
├── ERPNext                   ├── OpenClaw Dropship (:3849)
└── Hearst Orchestrator       ├── Postgres 17 (:5433)
    (:3848)                   ├── Redis 7 (:6379)
                              ├── Coolify (:8000)
Supabase (managed)            └── vLLM embeddings/coding
├── products (527 items)
├── sites
├── catalogs
├── campaigns
└── sync_logs

Railway (backup)
└── dropship-backend-backup (pending deploy)
```

## Monorepo Structure

```
apps/
  admin/              Next.js admin dashboard (:3200)
  storefront/         Next.js storefront (deployed GPU2)
  medusa/             Medusa v2 config (standalone Docker GPU2)
  openclaw-dropship/  Express backend for dropshipping orchestration (:3849)

packages/
  core/               Shared types & DTOs
  ui/                 Shared React components
  suppliers/          CJ Dropshipping, Shopify, AliExpress integrations
  marketing/          Google Ads & Meta Marketing APIs
  ai/                 vLLM + ComfyUI integration
  design-systems/     10 design systems for storefront theming

prompts/
  agent-supplier-research.md   Prompt for supplier audit agent
  agent-shop-creator.md        Prompt for shop creation agent

scripts/
  deploy-storefront.sh         Deploy storefront on GPU2
  sync-products-to-medusa.ts   Sync products from Supabase to Medusa
```

## Services

| Service | Host | Port | Status |
|---------|------|------|--------|
| Medusa v2 API | GPU2 | 9000 | LIVE |
| OpenClaw Dropship | GPU2 | 3849 | LIVE |
| Storefront OnePeace | GPU2 | 3100 | LIVE |
| Storefront Anime | GPU2 | 3101 | LIVE |
| Postgres 17 | GPU2 | 5433 | LIVE |
| Redis 7 | GPU2 | 6379 | LIVE |
| Coolify | GPU2 | 8000 | LIVE |
| vLLM 32B | GPU1 | 8000 | LIVE (auth) |
| vLLM 7B | GPU1 | 8001 | LIVE (auth) |
| OpenClaw Original | GPU1 | 3848 | LIVE |
| Admin Dashboard | local | 3200 | DEV |
| Supabase | managed | — | LIVE |

## Admin Dashboard Features

- **Dashboard**: Stats, sites list, sync logs
- **Quick Actions**: One-click shop creation, product search, supplier browse
- **Product Discovery**: Trending products from Google Trends, CJ, AliExpress, TikTok with sources
- **Shop Wizard**: 5-step pipeline (niche → design → config → resume → deploy)
- **Discover Page**: Full-page trending product search with bulk import

## Environment Variables

Copy `.env.local` and set:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `GPU1_HOST`, `GPU2_HOST`, `GPU_SSH_USER`
- `CJ_DROPSHIPPING_API_KEY`
- `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `COOLIFY_URL`, `COOLIFY_TOKEN`

## Quick Start

```bash
npm install
npm run dev          # All apps in dev mode
npm run build        # Build all
npm run type-check   # TypeScript checks
```

## Deploy New Storefront

```bash
./scripts/deploy-storefront.sh <slug> <port> [sales-channel-id]

# Examples:
./scripts/deploy-storefront.sh anime-shop 3102
./scripts/deploy-storefront.sh figurines 3103
```

Or use the **Shop Wizard** in the admin dashboard at `/sites/new`.

## Medusa Backend

Deployed on GPU2 via Docker: `http://100.110.74.114:9000`
- Admin: `http://100.110.74.114:9000/app`
- Store API: `http://100.110.74.114:9000/store/products`
- 527 products synced
- Stripe live configured

## OpenClaw Dropship Backend

Express API on GPU2:3849 for dropshipping orchestration.
- `GET /health` — service health
- `GET /products/search?q=...` — search supplier products
- `POST /shop/create` — full shop creation pipeline

Persisted via crontab for auto-restart on reboot.

## Stripe Payments

Live Stripe keys are configured in Medusa on GPU2.
Publishable key available in `.env.local`.

## Design Systems

10 built-in design systems in `packages/design-systems/`:
- `ds-01`: Minimal White
- `ds-02`: Neo Tokyo
- `ds-03`: Earth Organic
- `ds-04`: Bold Pop
- `ds-05`: Classic Commerce
- `ds-06`: Luxury Gold
- `ds-07`: Sport Energy
- `ds-08`: Pastel Bloom
- `ds-09`: Tech Dark
- `ds-10`: Streetwear

## Docker Networking Note

GPU2 has a kernel bug with Docker bridge veth pairs for new containers.
All services use `--network host` as workaround.
