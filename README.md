# dropship-platform

Application **Next.js** dans `apps/web` : admin, API Medusa, Supabase.

## Status intégrations fournisseurs

### Clés récupérées et configurées
- ✅ CJ Dropshipping API key ajoutée sur Vercel
- ✅ AliExpress App Key + Secret ajoutés sur Vercel
- ✅ Clients API créés (`lib/suppliers/cj.ts`, `lib/suppliers/aliexpress.ts`)
- ✅ Route d'import `/api/suppliers/import` fonctionnelle

### Actions requises (bloquantes)
⚠️ **Les APIs nécessitent des permissions développeur :**

**CJ Dropshipping** : Erreur `APIkey is wrong` (code 1600005)
- Credentials testés : `adrien@hearstcorporation.io` / `Sasha0334$$`
- **Action** : Contacter support CJ via dashboard pour activer l'accès API développeur
- Le compte CJ standard n'a pas l'API activée par défaut
- Support : https://cjdropshipping.com/ → Contact Agent (chat en bas à droite)

**AliExpress** : Erreur `App does not have permission to access this api`
- App Key `531346` (statut Online, catégorie Drop Shipping)
- **Action** : Demander l'accès à "Affiliate Product Query API"
  1. Aller sur https://open.aliexpress.com/console
  2. Cliquer sur l'app (531346)
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
