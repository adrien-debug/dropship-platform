# dropship-platform

Application **Next.js** dans `apps/web` : admin, API Medusa, Supabase.

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

Détails locaux et Medusa : `apps/web/README.md`.
