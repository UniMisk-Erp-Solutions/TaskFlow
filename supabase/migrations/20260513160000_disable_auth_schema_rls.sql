-- Disable RLS on auth schema tables.
--
-- The auth schema is internal to GoTrue (supabase-auth). It runs as the
-- supabase_auth_admin role, which does NOT have rolbypassrls, so any RLS
-- enabled on auth tables blocks gotrue from inserting/updating rows. In
-- particular, `INSERT INTO auth.identities ...` was being rejected with
-- "42501: new row violates row-level security policy for table "identities""
-- causing signup to fail with "Database error creating new user".
--
-- Stock Supabase installs ship with RLS disabled on auth.* (the schema is
-- access-controlled by the gotrue API surface, not by Postgres row policies).
-- This migration restores that default.
--
-- Idempotent: only acts on tables where rowsecurity is currently true.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'auth' AND rowsecurity = true
  LOOP
    EXECUTE format('ALTER TABLE auth.%I DISABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
