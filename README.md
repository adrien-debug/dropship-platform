# Dropship Platform

Multi-site dropshipping platform built with Turborepo monorepo.

## Architecture

```
GPU1 (100.88.191.49)          GPU2 (100.110.74.114)
├── vLLM Qwen 32B (:8000)    ├── Storefront (:3100)
├── vLLM Qwen 7B (:8001)     ├── Medusa v2 API (:9000)
├── ComfyUI (:8188)           ├── Postgres 17 (:5433)
├── ERPNext                   ├── Redis 7 (:6379)
└── Hearst Orchestrator       ├── Coolify (:8000)
                              ├── vLLM GPU2 (:8000)
Supabase (managed)            └── vLLM embeddings/coding
├── products (300+ items)
├── sites
├── catalogs
├── campaigns
└── sync_logs
```

## Monorepo Structure

```
apps/
  admin/        Next.js 14 admin dashboard
  storefront/   Next.js storefront (deployed GPU2:3100)
  medusa/       Medusa v2 config (standalone at ~/Desktop/dropship-medusa)

packages/
  core/         Shared types & DTOs
  ui/           Shared React components
  suppliers/    CJ Dropshipping, Shopify, AliExpress integrations
  marketing/    Google Ads & Meta Marketing APIs
  ai/           vLLM + ComfyUI integration

trigger/        Trigger.dev background jobs
```

## Services Running on GPU2

| Service | Port | Image | Status |
|---------|------|-------|--------|
| Storefront | 3100 | `onepeace-storefront:v3` | `--network host` |
| Medusa v2 | 9000 | `dropship-medusa:v1` | `--network host` |
| Postgres 17 | 5433 | `postgres:17-alpine` | `--network host` |
| Redis 7 | 6379 | `redis:7-alpine` | `--network host` |
| Coolify | 8000 | `coollabsio/coolify` | bridge network |

## Environment Variables

Copy `.env.local` and set:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `GPU1_HOST`, `GPU2_HOST`, `GPU_SSH_USER`
- `CJ_DROPSHIPPING_API_KEY`
- `COOLIFY_URL`, `COOLIFY_TOKEN`

## Quick Start

```bash
npm install
npm run dev          # All apps in dev mode
npm run build        # Build all
npm run type-check   # TypeScript checks
```

## Medusa Backend (Standalone)

```bash
cd ~/Desktop/dropship-medusa
npm run dev          # Dev mode on :9000
npm run build        # Production build
```

Deployed on GPU2 via Docker: `http://100.110.74.114:9000`
Admin dashboard: `http://100.110.74.114:9000/app`

## Deploy New Storefront

```bash
./scripts/deploy-storefront.sh <slug> <port> [sales-channel-id]

# Examples:
./scripts/deploy-storefront.sh anime-shop 3102
./scripts/deploy-storefront.sh figurines 3103
```

Deploys in ~5 seconds on GPU2 with `--network host`.

## Sync Products to Medusa

```bash
npx tsx scripts/sync-products-to-medusa.ts
```

Syncs all products from Supabase into Medusa with categories and pricing.

## Stripe Payments

Add to Medusa `.env`:
```
STRIPE_API_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```
Then restart Medusa container.

## Health Check

`GET /api/health` on admin app returns status of all services.

## Docker Networking Note

GPU2 has a kernel bug with Docker bridge veth pairs for new containers.
All services use `--network host` as workaround.
