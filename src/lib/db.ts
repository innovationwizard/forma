import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client for the whole app.
 *
 * In Next.js dev mode, every code change triggers a server-side module reload.
 * Without caching, that creates a new PrismaClient per reload and exhausts the
 * Postgres connection pool within a few hot reloads. Caching on `globalThis`
 * keeps the same instance across reloads in dev, while production gets a
 * single instance per process as expected.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
