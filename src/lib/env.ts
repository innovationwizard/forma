import { z } from "zod";

/**
 * Typed environment loader. Validates `process.env` at module load time so a
 * missing or malformed variable surfaces as a precise error at boot, not as a
 * confusing crash later.
 *
 * Two schemas, two exports:
 *  - `clientEnv` — only `NEXT_PUBLIC_*` vars. Safe to import anywhere.
 *  - `serverEnv` — full env including secrets. Server-only; importing from a
 *    client component crashes the build (good — that's the boundary).
 *
 * Batch 1 keeps Supabase + Prisma vars `.optional()` so the scaffold boots
 * without secrets. Batch 2 flips them to `.min(1)` once wiring lands.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("FORMA — Santa Elena"),
});

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
});

function parseOrThrow<T>(schema: z.ZodType<T>, source: unknown, label: string): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid ${label} environment variables:\n${issues}`);
  }
  return result.data;
}

export const clientEnv = parseOrThrow(
  clientSchema,
  {
    NEXT_PUBLIC_APP_NAME: process.env["NEXT_PUBLIC_APP_NAME"],
  },
  "client",
);

export const serverEnv =
  typeof window === "undefined"
    ? parseOrThrow(serverSchema, process.env, "server")
    : (null as never);
