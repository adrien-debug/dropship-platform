# @dropship/web

Frontend Next.js 15 (App Router) + agents IA + storefronts publics par boutique.

## Quickstart

```bash
cp env.example .env.local         # remplir les credentials
npm install
npm run dev                       # http://localhost:3063
```

L'auth admin est par HTTP Basic (middleware Edge). `ADMIN_USERNAME` + `ADMIN_PASSWORD` doivent être set sinon toutes les routes `/admin/*` répondent 401.

## Scripts

```bash
npm test            # Vitest run-once (197 tests)
npm run test:watch  # mode watch
npm run lint        # tsc --noEmit + ESLint
npm run typecheck   # tsc seul
npm run build       # build prod Next.js
npm run start       # serveur prod local
```

## Structure

```
app/
├ admin/                       Console admin (Basic Auth via middleware)
│  ├ (app)/
│  │  ├ page.tsx               Dashboard portfolio
│  │  ├ stores/                Liste + création + détail par store
│  │  │  └ [id]/
│  │  │     ├ catalog/         Produits du store
│  │  │     ├ assets/          Régénération médias
│  │  │     ├ curate/          Chat curation produits
│  │  │     ├ ads/             Chat ads + push Meta/TikTok + perf
│  │  │     ├ analytics/       KPIs du store
│  │  │     ├ copilot/         Hub 5 modes
│  │  │     └ settings/        Template + domaine + tokens analytics
│  │  ├ orders/                Commandes Stripe + forward AE
│  │  └ observability/         Coût Claude par step
│  └ _components/AdminShell    Sidebar + layout
├ api/
│  ├ agent/                    Routes SSE des copilotes
│  ├ analytics/                Tracking server-side (purchase, view_content...)
│  ├ checkout/                 Stripe + Medusa payment session
│  ├ aliexpress/oauth/         OAuth flow AE + refresh cron
│  ├ medusa/                   Health + setup
│  └ stripe/webhook/           Stripe webhook handler
├ shop/[slug]/                 Storefront public par store
└ page.tsx                     Redirige / → /admin

lib/
├ agent/                       store-creator, copilots, asset-generator, dev-copilot, ...
├ analytics/                   funnel, meta-capi, tiktok-events, ga4-mp, google-ads, pixel-client
├ ads/                         meta-ads, tiktok-ads, performance (push + analytics)
├ research/                    tavily, perplexity clients
├ trends/                      meta-library scraper
├ suppliers/                   aliexpress, cj clients
├ ops/                         anomaly-watch
├ storage/r2.ts                Cloudflare R2 upload
├ db.ts                        getDb() + getDbRead()
├ medusa.ts                    Medusa Admin client
├ medusa-store.ts              Medusa Storefront client (publishable-key based)
├ store-config.ts              getStoreBySlug, decrypt secrets
├ secrets.ts                   AES-256-GCM
└ seo.ts                       JSON-LD, canonical, sitemap helpers

components/
├ ui/                          Design system primitives (storefronts)
└ analytics/                   StoreAnalytics, TrackPageView

infra/postgres/                23 migrations + .down.sql

middleware.ts                  Edge: Basic Auth + UTM capture + custom domain rewrite
```

## Tests

Vitest. Mocking via `vi.mock()` + MSW pour HTTP. Patterns dans `lib/ops/anomaly-watch.test.ts`. E2E pipeline agent dans `lib/agent/store-creator.e2e.test.ts`.

```bash
npx vitest run                                 # tout
npx vitest run lib/analytics                   # un dossier
npx vitest run lib/ads/meta-ads.test.ts        # un fichier
```

## Déploiement

**Vercel** (canonique) :
- Root Directory: `apps/web`
- Build par défaut Next.js
- Toutes les env vars de `env.example`

**Railway** (alternative) : `railway.toml` fixe `npm run start` sur `0.0.0.0:PORT`.

## Crons (GitHub Actions)

- `.github/workflows/medusa-warmup.yml` — ping `/api/medusa/health` toutes les 5 min (évite le cold start Railway)
- `.github/workflows/ae-token-refresh.yml` — refresh quotidien du token OAuth AliExpress

## Connexion admin Medusa

`MEDUSA_ADMIN_EMAIL` + `MEDUSA_ADMIN_PASSWORD` requis pour les routes Admin Medusa appelées par l'agent (création produit, sales channel, publishable key).

`MEDUSA_URL` obligatoire en prod, fallback `http://localhost:9000` en dev.
