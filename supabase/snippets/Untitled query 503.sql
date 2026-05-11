begin;

-- 1) Remove app data that depends on profiles/users
truncate table public.email_logs restart identity cascade;
truncate table public.meeting_attachments restart identity cascade;
truncate table public.tasks restart identity cascade;
truncate table public.meetings restart identity cascade;
truncate table public.profiles restart identity cascade;
truncate table public.organizations restart identity cascade;

-- 2) Remove Auth users (this deletes login accounts)
delete from auth.users;

commit;