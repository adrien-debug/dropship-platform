# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

Monorepo (npm workspaces are NOT used — each app has its own `package_lock.json` and is installed independently):

| Path | Stack | Deploy target | Dev port |
|---|---|---|---|
| `apps/web/` | Next.js 15 (App Router) + Postgres + Medusa client | Vercel | **4302** (Turbopack) |
| `apps/medusa/` | Medusa v2.13 backend | Railway (`medusa-production-656a.up.railway.app`) | — |
| `apps/desktop/` | Electron 33 wrapper (macOS) around the web admin | local DMG | wraps the web app |
| `apps/landing/` | Marketing site, Next.js 15 | (not yet wired) | 4303 |
| `infra/postgres/` | 27 numbered SQL migrations, each with a `.down.sql` | applied manually | — |

`apps/web` is the main app — almost all work happens there. Commands below assume `cd apps/web` unless stated otherwise.

## Common commands (apps/web)

```bash
npm run dev          # Next dev with Turbopack on port 4302
npm test             # Vitest run (Node env, MSW set up in test/setup-msw.ts)
npm run test:watch   # Vitest watch
npm run lint         # tsc --noEmit + ESLint
npm run typecheck    # tsc only
npm run build        # next build
npm run go-live:check  # scripts/check-go-live.mjs — preflight before prod
```

Run a single test: `npx vitest run path/to/file.test.ts` or `npx vitest run -t "test name"`.

CI (`.github/workflows/ci.yml`) runs `npm run lint && npm test` from `apps/web` on every push/PR. Other workflows: `medusa-warmup.yml` (5-min cron pinging Medusa), `ae-token-refresh.yml` (daily AliExpress OAuth refresh), `order-anomaly-watch.yml`.

## Architecture: how the pieces fit

### Two data planes that coexist

The frontend talks to **both** Postgres directly **and** Medusa — they hold different things:

- **Postgres** (`lib/db.ts`, `getDb()` for writes, `getDbRead()` for read-replica-friendly dashboards) owns everything platform-specific: stores config, AI run ledger, ad variants, order forwards, copilot sessions, analytics events, encrypted per-store tokens. All 27 migrations live in `infra/postgres/`.
- **Medusa** (`lib/medusa.ts`, `lib/medusa-store.ts`) owns the e-commerce catalog: products, variants, prices, sales channels, cart/checkout. Each store is a Medusa sales channel with its own publishable key (stored in `dropship_stores`).

When adding a feature, the rule of thumb: catalog → Medusa; everything else (config, AI, ads, attribution, sessions) → Postgres.

### The agent layer (`lib/agent/`)

Five Anthropic copilots share one tool_use loop topology; `copilot-router.ts` is the unified dispatcher. Each mode (`research`, `curation`, `ads`, `medias`, `dev`) defines a tool set + executors and persists messages into `dropship_copilot_messages` (legacy mode-specific tables remain for the old per-page routes).

**Every Anthropic SDK call MUST go through `trackedMessage()` in `lib/agent/anthropic.ts`** — it wraps `messages.create()` and logs tokens/latency/cost-in-EUR to `dropship_ai_runs`. Use `getAnthropicClient()` only as an escape hatch. Pricing per model is hardcoded in that file; add new model IDs to the `PRICING` map.

`store-creator.ts` is the pipeline that turns a niche keyword into a live store: supplier search (parallel AE + CJ via `Promise.allSettled`, fallback to Claude generation if both fail) → product scoring → image quality filter (`image-quality.ts`, claude-haiku-4-5 vision, $~0.001/img) → Medusa import → optional asset generation (`asset-generator.ts`, ComfyUI/fal.ai) → landing content (`landing-writer.ts`).

**Dev copilot safety** (`dev-copilot.ts`): whitelist of allowed commands, blocks `rm -rf` / `sudo` / `.env*` / `.git/` writes, modal confirmation before `git_push` when Auto-push is OFF. Do not weaken these guards.

### Edge middleware (`apps/web/middleware.ts`)

One middleware, three responsibilities (order matters):
1. **Custom domain rewrite** — non-platform host → resolve via `/api/domain-resolve` (cached 60s positive / 10s negative in a module-level Map) → rewrite to `/shop/{slug}`. Platform hosts are `localhost`, `*.vercel.app`, `*.hearstcorporation.io`, `*.hearst.ai`.
2. **Admin Basic Auth** for `/admin/*`, `/api/agent/*`, AE OAuth start, Medusa setup. Public carve-outs are listed in `PUBLIC_EXCEPTIONS`.
3. **UTM capture** on `/shop/:path*` — stashes `utm_*`, `fbclid`, `ttclid`, `gclid` in a 30-day first-party cookie for downstream attribution.

### Storefront templates (`apps/web/app/shop/[slug]/`)

8 swappable templates (`MonoProductLanding`, `CollectionEditorialLanding`, `LuxuryMinimalLanding`, `GenZBoldLanding`, `EditorialFashionLanding`, `WellnessSoftLanding`, …). The template is chosen at render time from `dropship_stores.template`; `'auto'` derives from product count + mono/collection mode. `[slug]/page.tsx` is `force-dynamic`.

Storefront copy comes from `dropship_stores.landing_content` (JSON written by `landing-writer.ts` at store creation). Storefront colors/fonts come from the locked design system in `dropship_stores.design_preset` + `palette` — templates must read from there, not invent new values.

### Analytics fan-out

Server-side purchase event fans out **in parallel** to 4 platforms: Meta CAPI, TikTok Events API, Google Ads Click Conversions (Enhanced Conversions), GA4 Measurement Protocol. Per-store tokens (`meta_capi_token`, `tiktok_events_token`, `ga4_api_secret`) are stored AES-256-GCM-encrypted in `dropship_stores.*_enc` + `*_nonce` columns and decrypted via `lib/secrets.ts` using `STORE_SECRETS_KEY`. The plain `*_token` columns exist for legacy rows — `tryDecryptSecret()` handles both transparently.

### Suppliers (`lib/suppliers/`)

Two clients with the same shape: `aliexpress.ts` (DS API, OAuth token cached in `platform_settings`, auto-refreshed by `ae-token-refresh.yml`) and `cj.ts` (access token cache 1h). Both expose product search. `store-creator.ts` runs them in parallel and the first one that returns ≥1 product wins; if both fail, Claude generates synthetic products as a last resort.

## Migration discipline

Every change to Postgres goes through a new pair of files in `infra/postgres/`:

```
NNN_short_name.sql          # idempotent forward migration
NNN_short_name.down.sql     # rollback
```

Forward migrations must be re-runnable (use `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc.) because they're applied manually against the Railway instance and there's no migration runner tracking state. Match the existing numbering (`027_template_editorial_fashion.sql` is the latest at time of writing).

## Conventions worth knowing

- **Path alias**: `@/*` resolves to `apps/web/*` (configured in `tsconfig.json` and `vitest.config.ts`). All imports inside `apps/web` use `@/lib/...`, `@/components/...`, never relative `../../`.
- **No SSL on Postgres**: `lib/db.ts` sets `ssl: false` — Railway Postgres exposes a plain TCP proxy publicly. Don't add `?sslmode=require` to `DATABASE_URL`.
- **Two Postgres pools**: `getDb()` for writes/mutations, `getDbRead()` for read-only dashboards (uses `DATABASE_URL_REPLICA` when set, falls back to primary in dev).
- **Electron is opt-in**: `apps/desktop` shells the web admin in a BrowserWindow. The web app stays 100% browser-compatible — Electron integration is feature-detected via `window.electron`. Don't add Electron-only assumptions to the web codebase.
- **Mode mono vs collection**: `dropship_stores.mode` gates whether the asset generator + vision-filter + mono landing template run. Image-quality threshold differs (mono=0.65, collection=0.5).
- **Generated assets path**: ComfyUI/fal output writes to `apps/web/public/generated/{slug}/run-{ts}-flux-kontext/` with a `current/` symlink. This works in dev but Vercel has no persistent filesystem — see TODO in `asset-generator.ts` for the R2 migration plan.
- **French UI**: the admin and storefronts default to French (`language: 'fr'`). User-facing copy avoids em-dashes and LLM-tell triads (this is enforced by humans, not code).

## Variables d'environnement

Source of truth is [`apps/web/env.example`](apps/web/env.example). The README has a categorized list. The minimal set for `npm run dev` to boot: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, `MEDUSA_URL` + Medusa admin creds.

## Suppliers setup

Provisioning details for AliExpress DS API + CJ Dropshipping (OAuth flow, app permissions, diagnostic endpoints) live in `SUPPLIERS.md`. Read that before touching `lib/suppliers/` or `lib/agent/store-creator.ts`.

## Commandes locales calibrées (.claude/commands/)

Workspace calibré le 2026-05-18 via `/adrien-initialiser-workspace`. Les stubs dans `.claude/commands/` pré-câblent le contexte monorepo (app réelle = `apps/web`, port 4302, npm, Vercel + Railway, pas de Supabase) pour éviter la re-détection :

- `/dev-adrien` — kill + relance `npm run dev` depuis `apps/web` (port 4302) + Chrome
- `/audit-adrien` — audit unifié focalisé Next.js / agent layer / suppliers / Electron
- `/ship-adrien` — pre-PR vers `main` (lint + test depuis `apps/web`, attendre Vercel)
- `/brief-adrien` — briefing express 5 lignes
- `/ready-adrien` — preflight go-live (Vercel + Railway Postgres/Medusa)
- `/investigate-adrien` — debug guidé (repro + bisect + fix minimal)

Ces fichiers sont commités avec le repo (config workspace partagée). Relancer `/adrien-initialiser-workspace` après tout changement de stack, port ou service.
