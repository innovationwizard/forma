-- RLS policies for "public"."investment_phase" (matrix resource: "investment_phase")
ALTER TABLE "public"."investment_phase" ENABLE ROW LEVEL SECURITY;

-- MASTER bypass: a permissive policy granting full access when the JWT's role is MASTER.
DROP POLICY IF EXISTS "investment_phase_master_bypass" ON "public"."investment_phase";
CREATE POLICY "investment_phase_master_bypass" ON "public"."investment_phase"
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'MASTER')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'MASTER');

-- CREATE: allowed for ANALISTA.
DROP POLICY IF EXISTS "investment_phase_create" ON "public"."investment_phase";
CREATE POLICY "investment_phase_create" ON "public"."investment_phase"
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('ANALISTA'));

-- READ: allowed for CEO, ANALISTA, AUXILIAR.
DROP POLICY IF EXISTS "investment_phase_read" ON "public"."investment_phase";
CREATE POLICY "investment_phase_read" ON "public"."investment_phase"
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('CEO', 'ANALISTA', 'AUXILIAR'));

-- UPDATE: allowed for ANALISTA.
DROP POLICY IF EXISTS "investment_phase_update" ON "public"."investment_phase";
CREATE POLICY "investment_phase_update" ON "public"."investment_phase"
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('ANALISTA'));

-- DELETE: allowed for ANALISTA.
DROP POLICY IF EXISTS "investment_phase_delete" ON "public"."investment_phase";
CREATE POLICY "investment_phase_delete" ON "public"."investment_phase"
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('ANALISTA'));
