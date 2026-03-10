// lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { getDbUrl } from "./getDbConfig";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

let prismaClient: PrismaClient | null = null;

export async function getPrisma() {
  if (!prismaClient) {
    const url = await getDbUrl(); // from DATABASE_URL (Supabase)
    prismaClient = new PrismaClient({ datasources: { db: { url } } });
  }
  
  return prismaClient;
}