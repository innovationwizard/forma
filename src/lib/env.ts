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
 * Supabase + Prisma vars are required since Batch 2. The app refuses to boot
 * if any of them is missing or malformed. The names and intent are documented
 * in `.env.example`; `.env.local` is gitignored.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("FORMA — Santa Elena"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
});

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Supabase secret key (legacy `SUPABASE_SERVICE_ROLE_KEY` is deprecated and
  // must not be reintroduced — see feedback_supabase_keys memory).
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
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
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  },
  "client",
);

export const serverEnv =
  typeof window === "undefined"
    ? parseOrThrow(serverSchema, process.env, "server")
    : (null as never);
