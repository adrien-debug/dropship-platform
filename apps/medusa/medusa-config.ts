import { defineConfig, loadEnv } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:3100",
      adminCors: process.env.ADMIN_CORS || "http://localhost:7001",
      authCors: process.env.AUTH_CORS || "http://localhost:3100,http://localhost:7001",
      jwtSecret: process.env.JWT_SECRET || "supersecret-change-me",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret-change-me",
    },
    workerMode: (process.env.MEDUSA_WORKER_MODE as "server" | "worker" | "shared") || "shared",
  },
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
  },
});
