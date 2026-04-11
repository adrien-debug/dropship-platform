# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

Turborepo monorepo (npm workspaces). See `README.md` for full architecture and env vars reference.

### Services (dev mode)

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Admin Dashboard | `npm run dev --workspace=apps/admin` | 3200 | Set `ADMIN_BYPASS_AUTH=true` in `.env.local` to skip auth |
| Storefront | `npm run dev --workspace=apps/storefront` | 3100 | |
| OpenClaw Dropship API | `npm run dev --workspace=apps/openclaw-dropship` | 3849 | Uses `tsx watch`; set `LLM_MODE=local` for mock LLM |
| Medusa v2 | `npm run dev --workspace=apps/medusa` | 9000 | Requires PostgreSQL 17 + Redis 7 (not available in cloud VM) |

Or start admin + storefront together: `npx turbo dev --filter=@dropship/admin --filter=@dropship/storefront`

### Key gotchas

- **npm install is very slow** (~15-20 min) due to Medusa v2 + SWC native bindings. The lockfile is large.
- **Medusa cannot run locally** without PostgreSQL 17 (port 5433) and Redis 7. Skip it in cloud VM; admin/storefront/openclaw still work without it (API calls to Medusa will fail gracefully).
- **ESLint v8** is required (not v9) because Next.js 14 uses the legacy ESLint API. `eslint-config-next@14` must match the Next.js version.
- **Type-check**: `@dropship/medusa` has pre-existing TS errors in email templates (React version conflict between v18/v19, missing `resend`/`minio` modules). All other 12 packages pass cleanly.
- **Lint**: Admin and storefront have pre-existing warnings (`<img>` instead of `<Image />`, unescaped entities). These are not blocking.
- **Env files**: Each app needs its own `.env.local` (admin, storefront) or `.env` (openclaw). See `.env.example` files in root and each app directory for required variables.
- **OpenClaw `LLM_MODE=local`**: Bypasses LLM calls with deterministic mock content. Use this when vLLM/OpenAI are unavailable.
- **`ADMIN_BYPASS_AUTH=true`**: Skips admin auth middleware; required in cloud VM where there's no login flow configured.

### Commands reference

- `npm run type-check` — type-check all packages (via turbo)
- `npm run lint` — lint all packages (via turbo); note `@dropship/suppliers` and `@dropship/core` need global `eslint`
- `npm run build` — build all packages
- `npm run dev` — start all dev servers via turbo
