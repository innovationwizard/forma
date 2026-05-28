/**
 * BANGUAT_CRON synthetic user — separate from XLSX_IMPORT so AuditLog rows
 * can be filtered by ingestion path.
 *
 * Mirrors `scripts/seed/system-user.ts` deliberately: same shape, different
 * deterministic UUID + email. Lives in `src/lib/` (not `scripts/`) because
 * the runtime cron handler needs it. Per D8 the seeder writes
 * XLSX_IMPORT-attributed AuditLog rows; this user writes BANGUAT_CRON-
 * attributed rows for the daily fetch.
 *
 * Role = MASTER → bypasses the RBAC matrix per D14 (the cron is a system
 * actor and skipping the matrix is intentional). `isActive=false` →
 * Supabase Auth never issues a JWT for this user; they cannot sign in.
 */

import type { PrismaClient } from "@prisma/client";

/// Deterministic UUID v4 format. RFC 4122 version-4 + variant-10 bits set.
/// `fbeebeef` prefix marks this as a Forma system actor.
export const BANGUAT_CRON_USER_ID = "fbeebeef-0000-4000-8000-000000000002";

const SYSTEM_USER_EMAIL = "banguat-cron@forma.internal";
const SYSTEM_USER_FULLNAME = "BANGUAT_CRON — daily exchange-rate fetch attribution";

export async function ensureBanguatCronUser(prisma: PrismaClient): Promise<string> {
  const user = await prisma.user.upsert({
    where: { id: BANGUAT_CRON_USER_ID },
    create: {
      id: BANGUAT_CRON_USER_ID,
      email: SYSTEM_USER_EMAIL,
      fullName: SYSTEM_USER_FULLNAME,
      role: "MASTER",
      isActive: false,
    },
    update: {
      email: SYSTEM_USER_EMAIL,
      fullName: SYSTEM_USER_FULLNAME,
      role: "MASTER",
      isActive: false,
    },
  });
  return user.id;
}
