# @dropship/web

Frontend Next.js 15 (App Router). Contient l'agent IA de création de stores et les storefronts publics par boutique.

## Local

```bash
cd apps/web
cp env.example .env.local
# éditer .env.local puis :
npm install
npm run dev
```

→ [http://localhost:3063](http://localhost:3063). La racine `/admin` redirige vers `/admin/stores`.

Vérifie les prérequis prod : `npm run go-live:check`.

## Pages clés

| Chemin | Rôle |
|---|---|
| `/admin/stores` | Liste des stores créés par l'agent |
| `/admin/stores/new` | Lance l'agent IA (niche → store complet) |
| `/admin/stores/[id]` | Détails d'un store + suppression |
| `/admin/catalog` | Vue catalogue Medusa global |
| `/admin/settings` | Statut des intégrations (AliExpress OAuth, etc.) |
| `/shop/[slug]` | Storefront public d'un store |
| `/shop/[slug]/products/[handle]` | PDP |

## Endpoints clés

- `POST /api/agent/create-store` — endpoint SSE qui pilote l'agent (search supplier → enrich Claude → import Medusa). `maxDuration=300`.
- `DELETE /api/agent/stores/[id]` — supprime un store + ses produits Medusa.
- `GET /api/agent/stores` — liste des stores.
- `GET /api/aliexpress/oauth/start` — flow OAuth AliExpress.
- `GET /api/aliexpress/test-search?keywords=...` — diagnostic recherche AE.
- `GET /api/medusa/health` — sonde le backend Medusa Railway (utile pour le réveiller).
- `GET/POST /api/medusa/setup` — initialise stock locations, fulfillment, shipping options et payment providers Medusa.

## Déploiement

### Vercel (frontend)

1. Vercel → importer le repo Git.
2. **Root Directory** : `apps/web`.
3. Variables d'env : reprendre `apps/web/env.example` (Anthropic, Medusa, Postgres, Stripe, AliExpress).
4. Deploy. `vercel.json` fournit la config build.

### Railway (alternative)

1. Service Railway → source Git, Root Directory `apps/web`.
2. Mêmes variables que sur Vercel.
3. `railway.toml` fixe `npm run start` (écoute `0.0.0.0` + `PORT`).

### Backend Medusa

Service séparé (`apps/medusa/`), déployé sur Railway. Renseigner `MEDUSA_URL` côté Vercel/Railway + auth (`MEDUSA_ADMIN_API_TOKEN` ou email/mot de passe).

## Connexion admin Medusa

Auth admin requise pour les routes `/admin/*` Medusa appelées par l'agent :

- **`MEDUSA_ADMIN_API_TOKEN`** (clé secrète Admin) *ou*
- **`MEDUSA_ADMIN_EMAIL`** + **`MEDUSA_ADMIN_PASSWORD`**

`MEDUSA_URL` est obligatoire en prod (pas de fallback). En `next dev` un fallback s'applique si la variable est vide.

## Tests et QA

- **Vitest** : `npm test` (run-once), `npm test:watch` en dev. Couverture actuelle : `lib/medusa-env`, `app/api/medusa/health`.
- **Lint** : `npm run lint` (= `tsc --noEmit` + ESLint `next/core-web-vitals` + `next/typescript`). `npm run typecheck` ou `npm run eslint` pour l'un ou l'autre seul.
- **CI** : `.github/workflows/ci.yml` (`npm run lint` + `npm test` dans `apps/web`).
