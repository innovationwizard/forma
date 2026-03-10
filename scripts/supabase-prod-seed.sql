-- Forma Supabase Production Seed
-- Run in Supabase SQL Editor: Dashboard > SQL Editor > New query
-- Ensures Forma company and admin users exist for single-tenant setup
-- Password for both users: Forma2026

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_company_id TEXT;
  v_ffranco_id TEXT;
  v_jorge_id TEXT;
  v_start_date TIMESTAMPTZ := date_trunc('day', NOW());
BEGIN
  -- 1. Get or create Forma company
  INSERT INTO companies (id, name, name_es, slug, status, created_at, updated_at)
  SELECT gen_random_uuid()::text, 'Forma', 'Forma', 'forma', 'ACTIVE', NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM companies WHERE slug = 'forma');

  SELECT id INTO v_company_id FROM companies WHERE slug = 'forma' LIMIT 1;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Failed to get/create Forma company';
  END IF;

  -- 2. Upsert ffranco@forma.gt
  INSERT INTO people (id, email, name, password, role, status, company_id, created_at, updated_at)
  VALUES (
    gen_random_uuid()::text,
    'ffranco@forma.gt',
    'ffranco',
    crypt('Forma2026', gen_salt('bf')),
    'ADMIN',
    'ACTIVE',
    v_company_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    password = crypt('Forma2026', gen_salt('bf')),
    company_id = v_company_id,
    role = 'ADMIN',
    status = 'ACTIVE',
    updated_at = NOW();

  SELECT id INTO v_ffranco_id FROM people WHERE email = 'ffranco@forma.gt' LIMIT 1;

  -- 3. Upsert jorge@forma.gt
  INSERT INTO people (id, email, name, password, role, status, company_id, created_at, updated_at)
  VALUES (
    gen_random_uuid()::text,
    'jorge@forma.gt',
    'jorge',
    crypt('Forma2026', gen_salt('bf')),
    'ADMIN',
    'ACTIVE',
    v_company_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    password = crypt('Forma2026', gen_salt('bf')),
    company_id = v_company_id,
    role = 'ADMIN',
    status = 'ACTIVE',
    updated_at = NOW();

  SELECT id INTO v_jorge_id FROM people WHERE email = 'jorge@forma.gt' LIMIT 1;

  -- 4. Upsert person_tenants (links users to Forma company)
  INSERT INTO person_tenants (id, person_id, company_id, start_date, status, created_at, updated_at)
  VALUES (gen_random_uuid()::text, v_ffranco_id, v_company_id, v_start_date, 'ACTIVE', NOW(), NOW())
  ON CONFLICT (person_id, company_id, start_date) DO UPDATE SET status = 'ACTIVE', updated_at = NOW();

  INSERT INTO person_tenants (id, person_id, company_id, start_date, status, created_at, updated_at)
  VALUES (gen_random_uuid()::text, v_jorge_id, v_company_id, v_start_date, 'ACTIVE', NOW(), NOW())
  ON CONFLICT (person_id, company_id, start_date) DO UPDATE SET status = 'ACTIVE', updated_at = NOW();

  RAISE NOTICE 'Forma seed OK. Company: %, ffranco: %, jorge: %', v_company_id, v_ffranco_id, v_jorge_id;
END $$;
