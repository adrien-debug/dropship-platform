FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/design-systems/package.json ./packages/design-systems/
COPY packages/ui/package.json ./packages/ui/
COPY packages/suppliers/package.json ./packages/suppliers/
COPY apps/storefront/package.json ./apps/storefront/
RUN npm install --workspaces --include-workspace-root --legacy-peer-deps
COPY packages/core/ ./packages/core/
COPY packages/design-systems/ ./packages/design-systems/
COPY packages/ui/ ./packages/ui/
COPY packages/suppliers/ ./packages/suppliers/
COPY apps/storefront/ ./apps/storefront/
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/apps/storefront
RUN npx next build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/storefront ./apps/storefront
WORKDIR /app/apps/storefront
EXPOSE 3100
ENV PORT=3100
CMD ["npx", "next", "start", "-p", "3100"]
