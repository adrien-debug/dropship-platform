# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

Turborepo monorepo with 4 apps and 8 shared packages. See `README.md` for full architecture and env var reference.

| Service | Port | Dev command |
|---------|------|-------------|
| Medusa v2 (e-commerce backend) | 9000 | `npm run dev` in `apps/medusa` |
| OpenClaw (dropshipping API) | 3849 | `npm run dev` in `apps/openclaw-dropship` |
| Admin Dashboard (Next.js) | 3200 | `npm run dev` in `apps/admin` |
| Storefront (Next.js) | 3100 | `npm run dev` in `apps/storefront` |

### Starting services

PostgreSQL and Redis must be running before Medusa can start:

```bash
sudo pg_ctlcluster 16 main start
sudo redis-server --daemonize yes
```

Then start services individually or use `npm run dev` at root (runs all via Turborepo).

### Non-obvious gotchas

- **ESLint version**: The project uses Next.js 14 which requires ESLint 8 and `eslint-config-next@14`. ESLint 9+ causes "Unknown options" errors.
- **Medusa `db:setup`/`seed` may fail** on the post-migration `link` and `query` resolution steps. The core tables are still created correctly. Product creation via the Admin API fails with `Could not resolve 'link'` — use the Medusa Admin UI at `http://localhost:9000/app` to create products instead, or ensure Redis is configured.
- **Medusa admin user**: Created with `npx medusa user -e admin@example.com -p supersecret` from `apps/medusa`.
- **OpenClaw in local mode**: Set `LLM_MODE=local` in `apps/openclaw-dropship/.env` to bypass vLLM/OpenAI calls (uses deterministic mock content).
- **External APIs (CJ, AliExpress, Supabase, Stripe)** are optional for local dev — the services degrade gracefully with placeholder env values. The OpenClaw health check will show `degraded` which is expected.
- **type-check**: `@dropship/medusa` has pre-existing TS errors in `email-notifications/templates/order-placed.tsx` (React 18 vs 19 types) and a missing `minio` module. These do not affect runtime.
- **Admin auth**: Login uses `ADMIN_AUTH_USER` / `ADMIN_AUTH_PASS` from `.env.local`.

### Lint and type-check

```bash
npm run lint        # turbo lint (admin + storefront have next lint)
npm run type-check  # turbo type-check (10/13 pass, medusa has pre-existing errors)
```
