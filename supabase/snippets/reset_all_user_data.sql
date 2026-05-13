-- ============================================================================
-- TaskFlow: Reset all user data (PRESERVES SCHEMA & FEATURES)
-- ----------------------------------------------------------------------------
-- Run this in Supabase Studio → SQL Editor with the `postgres` role.
--
-- WHAT IT DOES
--   * Wipes ALL user data: organizations, profiles, tasks, meetings, projects,
--     assignees, attachments, email logs, push subscriptions and notification
--     preferences.
--   * Removes every auth.users record (and auth.identities / sessions cascade
--     with it).
--   * Leaves the schema, RLS policies, triggers, functions, indexes and the
--     edge function code FULLY INTACT — so all new features (projects, multi
--     assignees, parent task/meeting, push notifications, org directory views)
--     keep working for the fresh signups.
--
-- WHAT IT DOES NOT DO
--   * It does NOT drop tables, types, functions or policies.
--   * It does NOT touch the storage buckets metadata structure (only file
--     references inside meeting_attachments).
--   * It does NOT modify the auth schema itself, only the rows in it.
-- ============================================================================

BEGIN;

-- 1) Temporarily disable the profile-creation trigger so cascading deletes do
--    not race with profile inserts during a flush.
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- 2) Wipe all dependent data in dependency-safe order via TRUNCATE ... CASCADE.
--    RESTART IDENTITY resets any serial sequences (none are user-visible today,
--    but it keeps things tidy).
TRUNCATE TABLE
  public.push_subscriptions,
  public.notification_preferences,
  public.task_assignees,
  public.meeting_assignees,
  public.meeting_attachments,
  public.email_logs,
  public.tasks,
  public.meetings,
  public.projects,
  public.profiles,
  public.organizations
RESTART IDENTITY CASCADE;

-- 3) Delete every auth user. This also clears auth.identities, auth.sessions,
--    auth.refresh_tokens, etc. via existing cascade FKs in the auth schema.
DELETE FROM auth.users;

-- 4) Re-enable the trigger so new signups again get a public.profiles row.
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

COMMIT;

-- ============================================================================
-- Verify (these should all return 0):
-- ============================================================================
SELECT 'auth.users'                   AS table_name, count(*) FROM auth.users
UNION ALL SELECT 'public.profiles',                  count(*) FROM public.profiles
UNION ALL SELECT 'public.organizations',             count(*) FROM public.organizations
UNION ALL SELECT 'public.projects',                  count(*) FROM public.projects
UNION ALL SELECT 'public.tasks',                     count(*) FROM public.tasks
UNION ALL SELECT 'public.meetings',                  count(*) FROM public.meetings
UNION ALL SELECT 'public.task_assignees',            count(*) FROM public.task_assignees
UNION ALL SELECT 'public.meeting_assignees',         count(*) FROM public.meeting_assignees
UNION ALL SELECT 'public.meeting_attachments',       count(*) FROM public.meeting_attachments
UNION ALL SELECT 'public.email_logs',                count(*) FROM public.email_logs
UNION ALL SELECT 'public.notification_preferences',  count(*) FROM public.notification_preferences
UNION ALL SELECT 'public.push_subscriptions',        count(*) FROM public.push_subscriptions;
