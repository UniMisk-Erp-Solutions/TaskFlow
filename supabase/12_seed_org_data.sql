-- Seed script: 1 org, 1 admin, 10 employees, 500 tasks, 100 meetings
-- Run this in Supabase SQL Editor.
-- NOTE: This creates auth users with known passwords for testing only.

DO $$
DECLARE
  v_org_id uuid;
  v_admin_id uuid;
  v_user_id uuid;
  v_identity_id uuid;
  v_email text;
  v_full_name text;
  v_plain_password text;
  v_role role_enum;
  v_employee_ids uuid[];
  v_idx int;
  v_assignee uuid;
  v_status status_enum;
  v_priority priority_enum;
  v_meeting_status meeting_status_enum;
  v_meeting_priority priority_enum;
  v_meeting_date date;
  v_meeting_time time;
BEGIN
  -- 1) Ensure one organization exists (idempotent by name)
  INSERT INTO public.organizations (name)
  VALUES ('Seed Org Alpha')
  ON CONFLICT DO NOTHING;

  SELECT id
  INTO v_org_id
  FROM public.organizations
  WHERE name = 'Seed Org Alpha'
  ORDER BY created_at
  LIMIT 1;

  -- Temporary table for seeded credentials (plain text only for test visibility)
  CREATE TEMP TABLE tmp_seed_users (
    full_name text,
    email text,
    plain_password text,
    role role_enum
  ) ON COMMIT DROP;

  INSERT INTO tmp_seed_users (full_name, email, plain_password, role) VALUES
    ('Seed Admin', 'admin.seed@example.com', 'Admin@123456', 'admin'),
    ('Seed Employee 01', 'emp01.seed@example.com', 'Emp01@123456', 'employee'),
    ('Seed Employee 02', 'emp02.seed@example.com', 'Emp02@123456', 'employee'),
    ('Seed Employee 03', 'emp03.seed@example.com', 'Emp03@123456', 'employee'),
    ('Seed Employee 04', 'emp04.seed@example.com', 'Emp04@123456', 'employee'),
    ('Seed Employee 05', 'emp05.seed@example.com', 'Emp05@123456', 'employee'),
    ('Seed Employee 06', 'emp06.seed@example.com', 'Emp06@123456', 'employee'),
    ('Seed Employee 07', 'emp07.seed@example.com', 'Emp07@123456', 'employee'),
    ('Seed Employee 08', 'emp08.seed@example.com', 'Emp08@123456', 'employee'),
    ('Seed Employee 09', 'emp09.seed@example.com', 'Emp09@123456', 'employee'),
    ('Seed Employee 10', 'emp10.seed@example.com', 'Emp10@123456', 'employee');

  -- 2) Create/update auth users + identities + profiles
  FOR v_idx IN 1..(SELECT count(*) FROM tmp_seed_users) LOOP
    -- Pull row by index for deterministic ordering
    SELECT u.email, u.full_name, u.plain_password, u.role
    INTO v_email, v_full_name, v_plain_password, v_role
    FROM tmp_seed_users u
    ORDER BY u.email
    OFFSET v_idx - 1
    LIMIT 1;

    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
      SELECT gen_random_uuid() INTO v_user_id;

      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_user_id,
        'authenticated',
        'authenticated',
        v_email,
        crypt(v_plain_password, gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('full_name', v_full_name, 'role', v_role::text),
        now(),
        now(),
        '',
        '',
        '',
        ''
      );
    ELSE
      UPDATE auth.users
      SET
        encrypted_password = crypt(v_plain_password, gen_salt('bf')),
        raw_user_meta_data = jsonb_build_object(
          'full_name', v_full_name,
          'role', v_role::text
        ),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
      WHERE id = v_user_id;
    END IF;

    SELECT id INTO v_identity_id
    FROM auth.identities
    WHERE provider = 'email'
      AND provider_id = v_email
    LIMIT 1;

    IF v_identity_id IS NULL THEN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        created_at,
        updated_at,
        last_sign_in_at
      )
      VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        v_email,
        now(),
        now(),
        now()
      );
    ELSE
      UPDATE auth.identities
      SET
        user_id = v_user_id,
        identity_data = jsonb_build_object(
          'sub', v_user_id::text,
          'email', v_email
        ),
        updated_at = now(),
        last_sign_in_at = now()
      WHERE id = v_identity_id;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, org_id, created_at)
    VALUES (
      v_user_id,
      v_email,
      v_full_name,
      v_role,
      v_org_id,
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      org_id = EXCLUDED.org_id;
  END LOOP;

  -- Capture admin and employees
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE email = 'admin.seed@example.com'
  LIMIT 1;

  SELECT array_agg(id ORDER BY email)
  INTO v_employee_ids
  FROM public.profiles
  WHERE org_id = v_org_id
    AND role = 'employee';

  -- 3) Reset old seeded records for clean re-runs
  DELETE FROM public.tasks WHERE org_id = v_org_id AND title LIKE 'Seed Task %';
  DELETE FROM public.meetings WHERE org_id = v_org_id AND title LIKE 'Seed Meeting %';

  -- 4) Insert 500 tasks
  FOR v_idx IN 1..500 LOOP
    v_assignee := v_employee_ids[1 + (v_idx % array_length(v_employee_ids, 1))];

    v_status := CASE
      WHEN v_idx % 7 = 0 THEN 'completed'::status_enum
      WHEN v_idx % 5 = 0 THEN 'blocked'::status_enum
      WHEN v_idx % 3 = 0 THEN 'in_progress'::status_enum
      ELSE 'pending'::status_enum
    END;

    v_priority := CASE
      WHEN v_idx % 3 = 0 THEN 'high'::priority_enum
      WHEN v_idx % 2 = 0 THEN 'medium'::priority_enum
      ELSE 'low'::priority_enum
    END;

    INSERT INTO public.tasks (
      title,
      description,
      assignee_id,
      priority,
      status,
      due_date,
      created_by,
      org_id,
      created_at,
      updated_at
    )
    VALUES (
      format('Seed Task %s', v_idx),
      format('Seeded task %s for load/UI testing', v_idx),
      v_assignee,
      v_priority,
      v_status,
      (current_date - 20 + (v_idx % 60)),
      v_admin_id,
      v_org_id,
      now() - ((v_idx % 40) || ' days')::interval,
      now()
    );
  END LOOP;

  -- 5) Insert 100 meetings
  FOR v_idx IN 1..100 LOOP
    v_assignee := v_employee_ids[1 + (v_idx % array_length(v_employee_ids, 1))];

    v_meeting_status := CASE
      WHEN v_idx % 8 = 0 THEN 'cancelled'::meeting_status_enum
      WHEN v_idx % 6 = 0 THEN 'completed'::meeting_status_enum
      ELSE 'scheduled'::meeting_status_enum
    END;

    v_meeting_priority := CASE
      WHEN v_idx % 3 = 0 THEN 'high'::priority_enum
      WHEN v_idx % 2 = 0 THEN 'medium'::priority_enum
      ELSE 'low'::priority_enum
    END;

    v_meeting_date := current_date - 10 + (v_idx % 45);
    v_meeting_time := make_time(9 + (v_idx % 9), (v_idx % 2) * 30, 0);

    INSERT INTO public.meetings (
      title,
      description,
      assignee_id,
      priority,
      status,
      meeting_date,
      meeting_time,
      created_by,
      org_id,
      created_at,
      updated_at
    )
    VALUES (
      format('Seed Meeting %s', v_idx),
      format('Seeded meeting %s for calendar testing', v_idx),
      v_assignee,
      v_meeting_priority,
      v_meeting_status,
      v_meeting_date,
      v_meeting_time,
      v_admin_id,
      v_org_id,
      now() - ((v_idx % 30) || ' days')::interval,
      now()
    );
  END LOOP;
END $$;

-- Credentials and summary
SELECT full_name, email, plain_password AS password, role
FROM (
  VALUES
    ('Seed Admin', 'admin.seed@example.com', 'Admin@123456', 'admin'),
    ('Seed Employee 01', 'emp01.seed@example.com', 'Emp01@123456', 'employee'),
    ('Seed Employee 02', 'emp02.seed@example.com', 'Emp02@123456', 'employee'),
    ('Seed Employee 03', 'emp03.seed@example.com', 'Emp03@123456', 'employee'),
    ('Seed Employee 04', 'emp04.seed@example.com', 'Emp04@123456', 'employee'),
    ('Seed Employee 05', 'emp05.seed@example.com', 'Emp05@123456', 'employee'),
    ('Seed Employee 06', 'emp06.seed@example.com', 'Emp06@123456', 'employee'),
    ('Seed Employee 07', 'emp07.seed@example.com', 'Emp07@123456', 'employee'),
    ('Seed Employee 08', 'emp08.seed@example.com', 'Emp08@123456', 'employee'),
    ('Seed Employee 09', 'emp09.seed@example.com', 'Emp09@123456', 'employee'),
    ('Seed Employee 10', 'emp10.seed@example.com', 'Emp10@123456', 'employee')
) AS creds(full_name, email, plain_password, role);

SELECT
  o.name AS organization,
  (SELECT count(*) FROM public.profiles p WHERE p.org_id = o.id) AS users_count,
  (SELECT count(*) FROM public.tasks t WHERE t.org_id = o.id AND t.title LIKE 'Seed Task %') AS tasks_count,
  (SELECT count(*) FROM public.meetings m WHERE m.org_id = o.id AND m.title LIKE 'Seed Meeting %') AS meetings_count
FROM public.organizations o
WHERE o.name = 'Seed Org Alpha';
