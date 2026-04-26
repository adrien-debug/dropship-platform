# @dropship/web

Next.js 15.

## Local

```bash
cd apps/web
cp env.example .env.local
# éditer .env.local puis :
npm install
npm run dev
```

→ [http://localhost:3063](http://localhost:3063) (racine redirige vers `/admin/medusa`).

Après avoir rempli `.env.local`, vérifie les prérequis prod : `npm run go-live:check` (voir aussi checklist racine `README.md`).

## Déploiement production

Tout tourne sur les **variables d’environnement** de l’hébergeur : plus besoin de machine locale une fois le dépôt branché.

### Vercel (recommandé pour ce frontend)

1. Projet Vercel → importer le repo Git.
2. **Root Directory** : `apps/web`.
3. **Environment Variables** : reprendre toutes les clés de `env.example` (Supabase, Medusa, etc.).
4. Deploy.

Fichier `vercel.json` : commandes de build par défaut.

### Railway (alternative pour ce même app Next)

1. Service Railway → source Git, **Root Directory** = `apps/web`.
2. Mêmes variables que sur Vercel.
3. `railway.toml` fixe `npm run start` (écoute `0.0.0.0` + `PORT`).

### Medusa (backend commerce)

À déployer **séparément** (autre repo / template Railway Medusa). Ensuite renseigner **`MEDUSA_URL`** + auth (`MEDUSA_ADMIN_API_TOKEN` ou email/mot de passe) dans Vercel ou Railway.

### Supabase

Créer un projet sur [supabase.com](https://supabase.com), activer la table `products` (schéma attendu par l’API publish), coller `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` dans l’hébergeur.

## Medusa — connexion admin API

- **`MEDUSA_ADMIN_API_TOKEN`** (clé secrète Admin) *ou*
- **`MEDUSA_ADMIN_EMAIL`** + **`MEDUSA_ADMIN_PASSWORD`**

En prod, **`MEDUSA_URL` est obligatoire** (pas de fallback). En `next dev` seulement, une URL de secours peut s’appliquer si la variable est vide.

État connexion : `GET /api/medusa/status` (page `/admin/medusa`).

Catalogue admin : `GET /api/products?status=all|draft|published&limit=50` (table `dropship_products`, `DATABASE_URL` requis). DDL à la racine du monorepo : `infra/postgres/001_dropship_products.sql`.

## Tests et QA

- **Vitest** : `npm test` (CI), `npm test:watch` en local — couverture : `lib/medusa`, `lib/types/product`, routes API `products`, `suppliers/*`, `medusa/*` (health, status, publish GET/POST).
- **Qualité** : `npm run lint` → `tsc --noEmit` puis **ESLint** (`next/core-web-vitals`, `next/typescript`). Seul le typage : `npm run typecheck`. Seul ESLint : `npm run eslint`.
- **CI GitHub** : `.github/workflows/ci.yml` (`npm run lint` + `npm test` dans `apps/web`).
- Vérifications manuelles fournisseurs : README racine du monorepo (curl import).
