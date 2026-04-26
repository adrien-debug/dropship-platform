# dropship-platform

Application **Next.js** dans `apps/web` : admin, API Medusa, Supabase.

## Status intégrations fournisseurs

### Clés récupérées et configurées
- ✅ CJ Dropshipping API key ajoutée sur Vercel
- ✅ AliExpress App Key + Secret ajoutés sur Vercel
- ✅ Clients API créés (`lib/suppliers/cj.ts`, `lib/suppliers/aliexpress.ts`)
- ✅ Route d'import `POST /api/suppliers/import` fonctionnelle
- ✅ Catalogue admin : `GET /api/products` (table `dropship_products`, variable `DATABASE_URL` sur l’app Next)

### Actions requises (bloquantes)
⚠️ **Les APIs nécessitent des permissions développeur :**

**CJ Dropshipping** : Erreur `APIkey is wrong` (code 1600005)
- **Action** : Contacter support CJ via dashboard pour activer l'accès API développeur
- Le compte CJ standard n'a pas l'API activée par défaut
- Support : https://cjdropshipping.com/ → Contact Agent (chat en bas à droite)

**AliExpress** : Erreur `App does not have permission to access this api`
- **Action** : Demander l'accès à "Affiliate Product Query API"
  1. Aller sur https://open.aliexpress.com/console
  2. Ouvrir ton application Open Platform (Drop Shipping)
  3. Section "API Access" → Request "Affiliate Product Query"
  4. Attendre approbation (24-48h)

**Note** : Le code est prêt et fonctionnera dès l'activation des permissions

**Test local une fois les clés mises à jour :**
```bash
cd apps/web
# Copier les nouvelles clés dans .env.local
curl -X POST http://localhost:3063/api/suppliers/import \
  -H "Content-Type: application/json" \
  -d '{"source":"cj","keywords":"phone case","limit":3,"autoImport":true}'
```

## Déploiement cloud (sans serveur local)

| Service    | Rôle |
|-----------|------|
| **Supabase** | Base Postgres + API ; créer un projet sur [supabase.com](https://supabase.com), récupérer l’URL et les clés. |
| **Railway**  | Backend **Medusa** (template officiel ou repo Medusa) + Postgres/Redis si besoin. |
| **Vercel**   | Frontend **Next** (`apps/web`) — recommandé pour Next.js. |

Tu peux aussi héberger le Next sur **Railway** (même repo, racine `apps/web`) au lieu de Vercel : voir `apps/web/railway.toml`.

### Variables d’environnement (Vercel ou Railway, projet `apps/web`)

Copier depuis `apps/web/env.example` et renseigner dans le dashboard :

- **Supabase** : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (routes serveur uniquement ; ne pas exposer la service role au client).
- **Postgres (produits dropship)** : `DATABASE_URL` (même base que celle où existe la table `dropship_products`).
- **Medusa** : `MEDUSA_URL`, `MEDUSA_ADMIN_API_TOKEN` (ou email + mot de passe admin).
- **Affichage** : `NEXT_PUBLIC_MEDUSA_URL` (URL publique du store Medusa, optionnel, pour l’UI).

### Vercel

1. Importer le dépôt Git.
2. **Root Directory** : `apps/web`.
3. Framework : Next.js (détecté automatiquement).
4. Ajouter les variables d’environnement ci-dessus → Deploy.

### Railway (Medusa)

Medusa est un **projet séparé** (souvent un autre repo). Sur Railway : nouveau service depuis le template Medusa ou ton backend, puis copier l’URL publique dans `MEDUSA_URL` côté Vercel.

### Railway (Next, optionnel)

1. New Project → Deploy from GitHub, même repo.
2. Racine du service : **`apps/web`** (settings du service).
3. Variables = même liste que Vercel.
4. Railway injecte `PORT` ; `npm run start` est compatible Next 15.

Détails locaux, Medusa et **tests/QA** : `apps/web/README.md`. CI : `.github/workflows/ci.yml` (`npm run lint` + `npm test` dans `apps/web`).

## Go-live rapide (checklist)

1. **Base Postgres** : sur l’instance visée par `DATABASE_URL`, exécuter **`infra/postgres/001_dropship_products.sql`** (création table + index).
2. **Variables** : copier `apps/web/env.example` → Vercel (ou Railway) pour le service dont la racine est **`apps/web`**, renseigner au minimum `DATABASE_URL`, `MEDUSA_URL`, et `MEDUSA_ADMIN_API_TOKEN` *ou* `MEDUSA_ADMIN_EMAIL` + `MEDUSA_ADMIN_PASSWORD`.
3. **Vérification locale** (avec `.env.local` rempli) : `cd apps/web && npm run go-live:check`.
4. **Déployer** : importer le repo Git, **Root Directory** `apps/web`, build par défaut (`next build`), domaine production.
5. **Smoke** : ouvrir `/admin/medusa`, vérifier `GET /api/medusa/status` et `GET /api/products` (liste vide ou produits).

*(Le déploiement sur ton compte Vercel/Railway ne peut pas être exécuté depuis ce dépôt sans tes identifiants ; les étapes ci-dessus préparent tout le nécessaire.)*
