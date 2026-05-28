import { redirect } from "next/navigation";
import { z } from "zod";

import { getRole, getUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function signIn(formData: FormData): Promise<void> {
  "use server";

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/login?reason=invalid-input");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    redirect("/login?reason=invalid-credentials");
  }
  redirect("/");
}

/// Server action: sign out from the login page. Used by the "missing-role"
/// path so a stuck user can clear their session and request access without
/// touching the database.
async function signOut(): Promise<void> {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const REASON_MESSAGES: Record<string, string> = {
  "missing-role":
    "Tu cuenta no tiene un rol asignado. Contacta al administrador para que lo configure.",
  "invalid-credentials": "Correo o contraseña incorrectos.",
  "invalid-input": "Revisa el formato del correo y vuelve a intentarlo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  // Already signed in? Either redirect home (role assigned) or fall through
  // to the missing-role state (signed in but no app_metadata.role) so we
  // don't bounce them back to `/` and trigger requireRole()'s redirect loop.
  const existingUser = await getUser();
  const existingRole = existingUser ? await getRole() : null;
  if (existingUser && existingRole) redirect("/");
  const stuckMissingRole = existingUser != null && existingRole == null;

  const params = await searchParams;
  const reason = stuckMissingRole ? "missing-role" : params.reason;
  const message = reason ? REASON_MESSAGES[reason] : undefined;

  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">FORMA — Santa Elena</h1>
          <p className="text-muted-foreground text-sm">
            {stuckMissingRole ? `Sesión iniciada como ${existingUser.email}` : "Inicia sesión para continuar"}
          </p>
        </header>

        {stuckMissingRole ? (
          <form action={signOut}>
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-medium shadow"
            >
              Cerrar sesión
            </button>
          </form>
        ) : (
        <form action={signIn} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-foreground text-sm font-medium">Correo electrónico</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-foreground text-sm font-medium">Contraseña</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="border-input bg-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>

          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-medium shadow"
          >
            Iniciar sesión
          </button>
        </form>
        )}

        {message && (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
