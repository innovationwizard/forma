// lib/getDbConfig.ts
// Supabase: Use DATABASE_URL directly from environment (Supabase provides this in project settings)

export async function getDbUrl(): Promise<string> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Configure it in your Supabase project settings.');
  }
  return url;
}

/** Returns config for pg Pool (connection string). Used by test_endpoint. */
export async function getDbConfig(): Promise<{ connectionString: string }> {
  const url = await getDbUrl();
  return { connectionString: url };
}
