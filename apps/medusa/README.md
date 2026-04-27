# `@dropship/medusa`

Medusa v2 backend, déployé sur Railway (service `medusa` du projet `dropship-medusa`).

## Configuration

Les variables d'env attendues côté runtime :

| Variable | Source | Rôle |
|---|---|---|
| `DATABASE_URL` | Postgres Railway | Connexion DB |
| `JWT_SECRET`, `COOKIE_SECRET` | Railway env | Sessions admin |
| `MEDUSA_ADMIN_EMAIL`, `MEDUSA_ADMIN_PASSWORD` | Railway env | Compte admin (créé au seed) |
| `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` | Railway env | CORS allowlist |
| `STRIPE_API_KEY` | Railway env | Provider Stripe (active automatiquement le module quand défini) |
| `STRIPE_WEBHOOK_SECRET` | Railway env | Vérif signature webhook Stripe |
| `DISABLE_MEDUSA_ADMIN` | Railway env | `true` désactive le build de l'UI admin |

## Build & deploy

Build Docker piloté par `Dockerfile`. Railway détecte le builder et exécute :
1. `npm install`
2. `medusa build`
3. `medusa db:migrate && medusa start`

## Stripe

Le module `@medusajs/medusa/payment-stripe` est conditionnellement chargé : si `STRIPE_API_KEY`
est défini, il est ajouté à `modules`. Sinon le backend tourne sans Stripe (fallback `pp_system_default`).

Pour activer le provider sur la région Europe après deploy, appeler depuis le storefront :

```
curl -X POST https://dropship-platform-amber.vercel.app/api/medusa/setup -d '{}'
```

L'endpoint détecte `pp_stripe_stripe` dans la liste globale des providers et l'attache à la région.
