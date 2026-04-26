# Configuration fournisseurs

## AliExpress Open Platform

1. Créer un compte développeur : [https://open.aliexpress.com/](https://open.aliexpress.com/)
2. Créer une application (Affiliate / Dropshipping API)
3. Récupérer :
   - **App Key**
   - **App Secret**
4. Ajouter dans Vercel (Project Settings → Environment Variables) :
   - `ALIEXPRESS_APP_KEY`
   - `ALIEXPRESS_APP_SECRET`

**Note :** AliExpress nécessite une approbation manuelle pour accéder à l'API Affiliate. Sans approbation, l'API retournera des erreurs auth.

## CJ Dropshipping

1. S'inscrire : [https://cjdropshipping.com/](https://cjdropshipping.com/)
2. Aller dans **Account → API** ou **Developer Center**
3. Générer une clé API (ou utiliser email + mot de passe si l'API v2 le supporte)
4. Ajouter dans Vercel :
   - `CJ_DROPSHIPPING_EMAIL` (email du compte)
   - `CJ_DROPSHIPPING_API_KEY` (clé générée ou mot de passe)

**Note :** CJ API v2 nécessite authentification via access token. Le client `lib/suppliers/cj.ts` gère ça automatiquement.

## Test local

```bash
cd apps/web
cp env.example .env.local
# Éditer .env.local avec les vraies clés
npm run dev
```

Tester l'import :
```bash
curl -X POST http://localhost:3063/api/suppliers/import \
  -H "Content-Type: application/json" \
  -d '{"source":"cj","keywords":"phone case","limit":5,"autoImport":true}'
```

## Prod (Vercel)

Après avoir ajouté les variables dans Vercel Dashboard :
```bash
cd apps/web
vercel --prod
```
