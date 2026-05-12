# Hearst Dropship Platform

Plateforme privée pilotée par agents IA pour gérer un portefeuille de boutiques DTC dropshipping (Hearst Corp).

À partir d'un mot-clé de niche, l'agent crée un store complet en 30 s : recherche fournisseurs réels, sélection IA, branding, import Medusa, génération d'assets visuels, storefront live. L'opérateur itère ensuite via un **copilote conversationnel** par store (curation produits, ads, médias, recherche, et même édition de code).

## Topologie

| Service | Source | Hébergeur |
|---|---|---|
| Frontend Next.js 15 + agents IA | `apps/web/` | Vercel |
| Backend Medusa v2.13 | service séparé (`medusa-production-656a.up.railway.app`) | Railway |
| Postgres (tout le portefeuille) | — | Railway |
| Object storage (assets) | bucket `dropship-assets` | Cloudflare R2 |
| Image/video generation | flux-pro/kontext + kling-video | fal.ai |

## Pages clés (`/admin`)

```
/admin                       Dashboard portfolio (KPIs cross-stores, alertes anomalies)
/admin/stores                Liste + création
/admin/stores/new            Création d'un store (copilote recherche + pipeline agent)
/admin/stores/[id]
  ├ /                        Aperçu (stats du store)
  ├ /catalog                 Produits du store
  ├ /assets                  Médias (régénération hero/cutout/lifestyles/vidéo)
  ├ /curate                  Chat curation produits
  ├ /ads                     Chat ads + push Meta/TikTok + performance ROAS
  ├ /analytics               Analytics du store
  ├ /copilot                 Hub central (5 modes: Recherche/Curation/Ads/Médias/Dev)
  └ /settings                Template, custom domain, tokens analytics
/admin/orders                Commandes Stripe + forward AliExpress
/admin/observability         Coût Claude par store/par étape
```

## Agents IA

5 copilotes Anthropic Claude (Sonnet 4.6) avec tool_use blocks, sessions persistées en DB, observabilité via `dropship_ai_runs`.

| Copilote | Outils typés | Page |
|---|---|---|
| **Recherche** | `web_search` (Tavily), `ask_perplexity`, `meta_ads_library`, `aliexpress_search`, `cj_search`, `shortlist_niche` | `/admin/stores/new` |
| **Curation** | `search_products`, `add_product`, `remove_product`, `update_price`, `rewrite_copy` | `/admin/stores/[id]/curate` |
| **Ads** | `list_variants`, `rewrite_hook`, `generate_visual` (fal.ai), `suggest_targeting`, `estimate_budget` | `/admin/stores/[id]/ads` |
| **Médias** | `regenerate_asset`, `set_as_current`, `list_assets` | `/admin/stores/[id]/assets` |
| **Dev** | `read_file`, `write_file`, `apply_patch`, `run_bash`, `git_commit`, `git_push` | `/admin/stores/[id]/copilot` |

Le mode **Dev** est full-agentic (lit/écrit/commit/push le repo lui-même) avec garde-fous : whitelist commandes, blocage `rm -rf` / `sudo` / `.env*` / `.git/`, modal de confirmation explicite avant `git_push` quand Auto-push est OFF.

## Intégrations externes (état actuel)

| Plateforme | Status | Détail |
|---|---|---|
| Meta Marketing API | **opérationnel** | App `Hdrop` (id `1279128647667691`), Ad Account `act_32397590`. Push live testé. |
| Google Ads API | **opérationnel** | MCC `601-062-7025` → client `287-713-4493`. Developer token actif, OAuth refresh token valide. Conversion Action `7607691528` créée. *Advertiser verification à compléter avant dépense réelle.* |
| TikTok Marketing API | **app en review** | Advertiser ID `7638829209548324865` (`Hearst_6k7hjt`). Tokens captés dès que TikTok valide l'app. |
| Cloudflare R2 | actif | bucket `dropship-assets` |
| fal.ai | actif | fallback automatique quand ComfyUI absent |
| AliExpress DS API | actif | OAuth + DS API search + ds.order.create |
| CJ Dropshipping | bloqué API key | non bloquant (AE seul suffit) |
| Stripe Checkout | actif | Live keys (single account) |

Côté analytics server-side, **4 plateformes câblées en parallèle** sur chaque event purchase :
Meta CAPI · TikTok Events API · Google Ads Click Conversions (Enhanced Conversions) · GA4 Measurement Protocol.

## Schéma Postgres

23 migrations idempotentes dans `infra/postgres/`, chacune avec son `.down.sql`. Tables principales :

```
dropship_stores                  config store + tokens analytics chiffrés
dropship_store_products          catalogue par store
dropship_order_forwards          attribution + forwarding AliExpress
dropship_funnel_events           events analytics (vue → ATC → checkout → purchase)
dropship_ai_runs                 cost ledger Claude (tokens, latence, erreurs)
dropship_ad_variants             créas fan-out Meta/TikTok/Google
dropship_ad_campaigns            log des pushes vers les Marketing APIs
dropship_asset_runs              historique régénérations d'assets
dropship_copilot_sessions        sessions du hub copilote
dropship_copilot_messages        messages (rôle + tool I/O)
dropship_curation_sessions       sessions curation (chat per-store)
dropship_research_sessions       sessions recherche de niche
dropship_trend_snapshots         cache 24h Meta Ads Library
dropship_rate_limits             rate limiting Postgres
platform_settings                tokens OAuth AliExpress
```

## Variables d'environnement

Voir [`apps/web/env.example`](apps/web/env.example). Catégories :

- **Auth admin** : `ADMIN_USERNAME`, `ADMIN_PASSWORD` (Basic Auth via middleware)
- **Postgres** : `DATABASE_URL`, optionnel `DATABASE_URL_REPLICA` (read-replica pour dashboards)
- **Medusa** : `MEDUSA_URL`, `MEDUSA_ADMIN_EMAIL`, `MEDUSA_ADMIN_PASSWORD`, `NEXT_PUBLIC_MEDUSA_*`
- **Anthropic** : `ANTHROPIC_API_KEY` (Claude Sonnet 4.6)
- **Fournisseurs** : `ALIEXPRESS_APP_KEY/SECRET`, `CJ_DROPSHIPPING_API_KEY/EMAIL`
- **Stripe** : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Ads APIs** : `META_ADS_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `TIKTOK_ADS_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID`, `GOOGLE_ADS_*` (6 vars)
- **Storage** : `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`
- **Génération** : `FAL_KEY`, optionnel `COMFY_DEPLOY_API_KEY` + `COMFY_DEPLOYMENT_*`
- **Analytics** : `STORE_SECRETS_KEY` (chiffrement AES-256-GCM des tokens CAPI), per-store via `dropship_stores`
- **Observabilité** : `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, optionnel `LANGFUSE_*`, `AXIOM_*`
- **Helpers** : `RESEND_API_KEY` (email alertes), `UPSTASH_REDIS_REST_URL/TOKEN` (cache futur), `ARCJET_KEY` (bot shield futur)

## Tests & CI

```bash
cd apps/web
npm install
npm run dev      # http://localhost:3063
npm test         # 197 tests Vitest
npm run build    # build prod
npm run lint     # tsc + ESLint
```

CI (`.github/workflows/ci.yml`) : lint + tests sur chaque push. Workflows séparés pour le warmup Medusa (cron 5 min) et le refresh OAuth AliExpress (cron quotidien).

## Desktop app

Wrapper Electron macOS-only (`apps/desktop/`) qui ouvre la console admin dans une fenêtre native, ajoute un icône menu-bar, des raccourcis globaux (`⇧⌘D` Dashboard, `⇧⌘N` New store, `⇧⌘O` Observability) et un watcher d'anomalies en tâche de fond (poll toutes les 5 min sur `/api/agent/ops/anomaly-watch` → notif critique macOS).

```bash
cd apps/desktop
npm install
HEARST_URL=http://localhost:3063/admin npm run dev   # dev local
npm run package                                       # build .app non signée
npm run dist                                          # build .dmg
```

L'app Next.js reste 100 % browser-compatible — l'intégration Electron est opt-in via `window.electron`. Détails : [`apps/desktop/README.md`](apps/desktop/README.md).

## Sécurité

- Auth admin par Basic Auth (Edge middleware), pas d'OAuth multi-utilisateur
- Tokens CAPI/TikTok/GA4 chiffrés AES-256-GCM en DB (`STORE_SECRETS_KEY`)
- Rate limiting Postgres sur les routes sensibles (`dropship_rate_limits`)
- Mode Dev du copilote : whitelist commandes, blocage path traversal, modal de confirmation avant push prod
- Aucun secret en clair dans le repo ; `.env.local` gitignored
