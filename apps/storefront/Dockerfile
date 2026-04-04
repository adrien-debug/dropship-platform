FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/ui/package.json ./packages/ui/
COPY apps/storefront/package.json ./apps/storefront/
RUN npm install --workspaces --include-workspace-root

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/apps/storefront/node_modules ./apps/storefront/node_modules
COPY package.json turbo.json tsconfig.base.json ./
COPY packages/core/ ./packages/core/
COPY packages/ui/ ./packages/ui/
COPY apps/storefront/ ./apps/storefront/
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/apps/storefront
RUN npx next build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/storefront/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/storefront/.next/static ./apps/storefront/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/storefront/server.js"]
