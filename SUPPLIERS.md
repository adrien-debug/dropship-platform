# Configuration fournisseurs

Les deux fournisseurs sont consommés par l'agent dans `apps/web/lib/agent/store-creator.ts` via les clients `apps/web/lib/suppliers/{aliexpress,cj}.ts`. Les deux APIs tournent en parallèle (`Promise.allSettled`) ; si l'une renvoie 0 produit, l'autre prend le relais. Si les deux échouent, l'agent passe en génération pure Claude.

## AliExpress Open Platform (DS API)

1. Créer un compte développeur : <https://open.aliexpress.com/>
2. Créer une application avec la permission group **AliExpress-dropship** (DS API, pas Affiliate).
3. Récupérer **App Key** + **App Secret** et les pousser dans Vercel :
   - `ALIEXPRESS_APP_KEY`
   - `ALIEXPRESS_APP_SECRET`
4. Console AliExpress : laisser **IP Whitelist vide** (Vercel a des IPs dynamiques).
5. Configurer le **Callback URL** sur l'alias prod (ex: `https://dropship-platform-amber.vercel.app/api/aliexpress/oauth/callback`).
6. Une fois déployé, ouvrir `GET /api/aliexpress/oauth/start` une seule fois pour autoriser l'app et stocker l'access/refresh token en DB (`platform_settings`). Le refresh est automatique ensuite.

API utilisée : `aliexpress.ds.text.search`. Le client demande `currency=EUR, countryCode=FR, local=fr_FR` pour avoir des prix en euros directement utilisables comme `cost_eur`.

Diagnostic : `GET /api/aliexpress/test-search?keywords=...` (sonde 3 méthodes DS/Affiliate avec le token courant).

## CJ Dropshipping

1. Créer un compte sur <https://cjdropshipping.com/>.
2. Aller dans **Account Settings → Developer** et **générer une vraie API Key** (chaîne hex). Le champ `password` de l'API CJ attend cette key, pas le mot de passe du compte (sinon erreur `1600005 - APIkey is wrong`).
3. Ajouter dans Vercel :
   - `CJ_DROPSHIPPING_EMAIL` (email du compte)
   - `CJ_DROPSHIPPING_API_KEY` (la key générée à l'étape 2)

Le client `apps/web/lib/suppliers/cj.ts` gère l'access token (cache 1h) et la recherche `POST /product/list`.

## Test

```bash
# Diagnostic AliExpress (token requis dans platform_settings)
curl 'https://<host>/api/aliexpress/test-search?keywords=yoga+mat'

# Pipeline complet
curl -N -X POST 'https://<host>/api/agent/create-store' \
  -H 'Content-Type: application/json' \
  -d '{"niche":"yoga","storeName":"Test","maxProducts":6,"language":"fr"}'
```
