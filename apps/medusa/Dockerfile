FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json medusa-config.ts ./
COPY src ./src
RUN npx medusa build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=9000
RUN apk add --no-cache tini
COPY --from=build /app/.medusa/server ./
RUN npm install --omit=dev --no-audit --no-fund --legacy-peer-deps
EXPOSE 9000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
