# dropship-platform

Plateforme SaaS de dropshipping pilotée par un agent IA. À partir d'un mot-clé de niche, l'agent (Claude Haiku) :

1. Cherche des produits réels chez **AliExpress** (DS API), avec fallback **CJ Dropshipping**.
2. Enrichit titres/descriptions, calcule un prix retail (×2.2 floor `.99`, min €9.99) et génère le branding du store dans le même call Claude.
3. Crée un sales channel + publishable API key Medusa dédiés au store, importe les produits par batch parallèle.
4. Sauve la config dans Postgres (Railway).
5. Le storefront est immédiatement live à `/shop/{slug}`.

## Topologie

| Service | Repo / sous-dossier | Hébergeur |
|---|---|---|
| Frontend Next.js + agent | `apps/web/` | Vercel |
| Backend Medusa v2 | `apps/medusa/` | Railway |
| Postgres (stores + tokens AE) | — | Railway |

Le frontend peut aussi tourner sur Railway via `apps/web/railway.toml`.

## Variables d'environnement

Voir `apps/web/env.example`. Côté `apps/web` les principales :

- **Postgres** : `DATABASE_URL` (tables `dropship_stores`, `dropship_store_products`, `platform_settings`).
- **Medusa** : `MEDUSA_URL`, `MEDUSA_ADMIN_API_TOKEN` (ou `MEDUSA_ADMIN_EMAIL` + `MEDUSA_ADMIN_PASSWORD`), `NEXT_PUBLIC_MEDUSA_URL` pour l'affichage.
- **Anthropic** : `ANTHROPIC_API_KEY` (Claude Haiku, modèle `claude-haiku-4-5-20251001`).
- **AliExpress** : `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`. Token OAuth stocké en DB via `/api/aliexpress/oauth/start`.
- **CJ Dropshipping** : `CJ_DROPSHIPPING_EMAIL`, `CJ_DROPSHIPPING_API_KEY` (la **vraie** API key, pas le mot de passe — voir `SUPPLIERS.md`).
- **Stripe** : `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.

Backend Medusa : voir `apps/medusa/README.md`.

## Schéma Postgres

DDL idempotent dans `infra/postgres/` :

- `002_stores.sql` — `dropship_stores` + `dropship_store_products`
- `003_platform_settings.sql` — `platform_settings` (token AliExpress)

(`001_dropship_products.sql` est conservé pour l'archive ; la table n'est plus écrite par le code.)

## Go-live

1. Postgres : exécuter `infra/postgres/002_stores.sql` puis `003_platform_settings.sql` sur la base pointée par `DATABASE_URL`.
2. Variables : copier `apps/web/env.example` dans Vercel/Railway, renseigner au moins `DATABASE_URL`, `MEDUSA_URL`, l'auth admin Medusa, `ANTHROPIC_API_KEY`, et les credentials AliExpress.
3. Vérification : `cd apps/web && npm run go-live:check` (avec `.env.local` rempli).
4. Deploy : Root Directory `apps/web`, build par défaut.
5. OAuth AliExpress : ouvrir `/api/aliexpress/oauth/start` une fois pour stocker le token en DB.
6. Smoke : ouvrir `/admin/stores/new`, créer un store sur une niche test, vérifier que le storefront `/shop/{slug}` s'affiche.

CI : `.github/workflows/ci.yml` (`npm run lint` + `npm test` dans `apps/web`).
