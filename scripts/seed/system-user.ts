/**
 * XLSX_IMPORT synthetic user per D8.
 *
 *   "synthetic XLSX_IMPORT system user (login-disabled). All seeded rows
 *    audited to this user with context='Initial xlsx import <date>'. Schema
 *    keeps user_id NOT NULL."
 *
 * The user has a DETERMINISTIC UUID (XLSX_IMPORT_USER_ID below) so re-running
 * the seed re-finds the same row. Role = MASTER per D14 (bypasses RBAC matrix);
 * isActive = false so a real human can never sign in as this user.
 *
 * Note: this user exists ONLY in `public.users` (the Prisma-managed mirror).
 * There is NO matching `auth.users` row — Supabase Auth never issues a JWT
 * for it. The `User.id` column has no FK to `auth.users`; verified in the
 * `20260523024245_full_schema` migration.
 */

import { PrismaClient } from "@prisma/client";

/// Deterministic UUID v4 format. Bits set per RFC 4122 (version 4, variant 10).
/// "fbeebeef" prefix is intentionally identifiable as the parser system user.
export const XLSX_IMPORT_USER_ID = "fbeebeef-0000-4000-8000-000000000001";

const SYSTEM_USER_EMAIL = "xlsx-import@forma.internal";
const SYSTEM_USER_FULLNAME = "XLSX_IMPORT — synthetic seed-attribution user (D8)";

export async function ensureXlsxImportUser(prisma: PrismaClient): Promise<string> {
  const user = await prisma.user.upsert({
    where: { id: XLSX_IMPORT_USER_ID },
    create: {
      id: XLSX_IMPORT_USER_ID,
      email: SYSTEM_USER_EMAIL,
      fullName: SYSTEM_USER_FULLNAME,
      role: "MASTER", // bypasses matrix; never used for real auth
      isActive: false, // login-disabled
    },
    update: {
      // Keep email/fullName/role in sync if any of them changed across runs.
      // isActive stays false — never re-enable a system user.
      email: SYSTEM_USER_EMAIL,
      fullName: SYSTEM_USER_FULLNAME,
      role: "MASTER",
      isActive: false,
    },
  });
  return user.id;
}
