-- Developer / operator views: browse the multi-tenant structure cleanly.
-- Every organization has its own UUID; profiles (admins + employees) carry org_id.
-- These views just present that data in a structured way for Supabase Studio.

-- Helpful indexes (no-ops if they already exist)
CREATE INDEX IF NOT EXISTS profiles_org_id_idx ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx   ON public.profiles(role);

-- 1) Flat directory: one row per user, with org info beside it.
--    Sort: org_name, then admins first, then by full_name/email.
CREATE OR REPLACE VIEW public.v_org_directory AS
SELECT
  o.id          AS org_id,
  o.name        AS org_name,
  o.created_at  AS org_created_at,
  p.id          AS user_id,
  p.email       AS user_email,
  p.full_name   AS user_full_name,
  p.role        AS user_role,
  p.created_at  AS user_created_at
FROM public.organizations o
LEFT JOIN public.profiles p ON p.org_id = o.id
ORDER BY
  o.name ASC,
  CASE WHEN p.role = 'admin' THEN 0 ELSE 1 END,
  COALESCE(NULLIF(p.full_name, ''), p.email) ASC NULLS LAST;

COMMENT ON VIEW  public.v_org_directory IS 'Flat per-user directory grouped by organization (admins first, then employees).';
COMMENT ON COLUMN public.v_org_directory.org_id    IS 'Organization UUID (primary key of organizations).';
COMMENT ON COLUMN public.v_org_directory.user_id   IS 'Profile/auth UUID for this admin or employee.';

-- 2) Per-org summary: counts of admins, employees, totals.
CREATE OR REPLACE VIEW public.v_org_summary AS
SELECT
  o.id          AS org_id,
  o.name        AS org_name,
  o.created_at  AS org_created_at,
  COUNT(p.id) FILTER (WHERE p.role = 'admin')    ::int AS admin_count,
  COUNT(p.id) FILTER (WHERE p.role = 'employee') ::int AS employee_count,
  COUNT(p.id)                                    ::int AS total_users,
  COALESCE(
    (SELECT COUNT(*)::int FROM public.tasks    t WHERE t.org_id = o.id),
    0
  ) AS task_count,
  COALESCE(
    (SELECT COUNT(*)::int FROM public.meetings m WHERE m.org_id = o.id),
    0
  ) AS meeting_count,
  COALESCE(
    (SELECT COUNT(*)::int FROM public.projects pr WHERE pr.org_id = o.id),
    0
  ) AS project_count
FROM public.organizations o
LEFT JOIN public.profiles p ON p.org_id = o.id
GROUP BY o.id, o.name, o.created_at
ORDER BY o.name ASC;

COMMENT ON VIEW public.v_org_summary IS 'One row per organization with admin/employee counts and workload totals.';

-- 3) Grouped JSON: nested {org, admins[], employees[]} – ideal for inspecting one org at a glance.
CREATE OR REPLACE VIEW public.v_org_users_grouped AS
SELECT
  o.id          AS org_id,
  o.name        AS org_name,
  o.created_at  AS org_created_at,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id',    p.id,
        'email',      p.email,
        'full_name',  p.full_name,
        'created_at', p.created_at
      )
      ORDER BY COALESCE(NULLIF(p.full_name, ''), p.email) ASC
    ) FILTER (WHERE p.role = 'admin'),
    '[]'::jsonb
  ) AS admins,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id',    p.id,
        'email',      p.email,
        'full_name',  p.full_name,
        'created_at', p.created_at
      )
      ORDER BY COALESCE(NULLIF(p.full_name, ''), p.email) ASC
    ) FILTER (WHERE p.role = 'employee'),
    '[]'::jsonb
  ) AS employees
FROM public.organizations o
LEFT JOIN public.profiles p ON p.org_id = o.id
GROUP BY o.id, o.name, o.created_at
ORDER BY o.name ASC;

COMMENT ON VIEW public.v_org_users_grouped IS 'Per-org nested JSON view: { admins:[...], employees:[...] }.';

-- Grant SELECT to authenticated for completeness; service_role/postgres can read anyway.
-- RLS on underlying tables (organizations, profiles) still applies for non-service roles.
GRANT SELECT ON public.v_org_directory     TO authenticated;
GRANT SELECT ON public.v_org_summary       TO authenticated;
GRANT SELECT ON public.v_org_users_grouped TO authenticated;
