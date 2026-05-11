begin;

-- Remove app data owned/assigned to this user first
delete from public.email_logs
where task_id in (
  select id from public.tasks
  where assignee_id = 'a6ff461b-d319-499e-a1dd-b040933324fc'
     or created_by  = 'a6ff461b-d319-499e-a1dd-b040933324fc'
);

delete from public.meeting_attachments
where assignee_id = 'a6ff461b-d319-499e-a1dd-b040933324fc'
   or created_by  = 'a6ff461b-d319-499e-a1dd-b040933324fc';

delete from public.tasks
where assignee_id = 'a6ff461b-d319-499e-a1dd-b040933324fc'
   or created_by  = 'a6ff461b-d319-499e-a1dd-b040933324fc';

delete from public.meetings
where assignee_id = 'a6ff461b-d319-499e-a1dd-b040933324fc'
   or created_by  = 'a6ff461b-d319-499e-a1dd-b040933324fc';

-- Remove profile
delete from public.profiles
where id = 'a6ff461b-d319-499e-a1dd-b040933324fc';

-- Remove auth account (actual login user)
delete from auth.users
where id = 'a6ff461b-d319-499e-a1dd-b040933324fc';

commit;