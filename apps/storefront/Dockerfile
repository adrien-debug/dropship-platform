FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY standalone/ ./
COPY static/ ./apps/storefront/.next/static/
COPY public/ ./apps/storefront/public/

WORKDIR /app/apps/storefront
EXPOSE 3100
ENV PORT=3100
CMD ["node", "server.js"]
