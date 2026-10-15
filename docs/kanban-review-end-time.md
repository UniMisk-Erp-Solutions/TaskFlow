# Optional End Time on Sending a Task for Review


## Behavior

- The review dialog has a "Set a different end time" checkbox with a `datetime-local` input whose `max` is the current time. Left unchecked, the end time is the moment of submission.
- Future values are rejected in the browser and on the server (HTTP 400, 60-second clock tolerance).
- Running timers for the task are closed at the reported end time, never before they started.
- The value is stored in `tasks.work_ended_at` and cleared if the task leaves Done.

## API

`PATCH /tasks/:id/board` accepts an optional `work_ended_at` ISO string alongside `kanban_column` and `kanban_order` (Edge Function and Express controller).

## Database

`supabase/migrations/20261015120000_task_work_ended_at.sql` adds the column and replaces `task_timer_close_when_done()` so it closes sessions at `LEAST(COALESCE(NEW.work_ended_at, now()), now())`, bounded below by each session's `started_at`.

## Rollout

Apply the migration (already applied to the TaskFlow production database) and redeploy the `api` Edge Function; otherwise the field is ignored and the current time is recorded.
