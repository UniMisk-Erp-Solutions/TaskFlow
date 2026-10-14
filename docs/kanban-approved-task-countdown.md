# Approved Task Done-Lane Countdown

## Purpose and behavior

After an administrator approves submitted work, the employee's Kanban Done lane keeps the task visible for 60 seconds. The task card displays a small `Clears in M:SS` countdown, then disappears from the employee Kanban board when the time expires. Its task status remains `completed`, so it stays in the employee's task list, completed totals, reports, and history. The administrator board does not auto-hide approved work.

The timer is anchored to the database field `tasks.kanban_approved_at`, written at the approval transition. Existing completed tasks with a null value stay in Done because they were not approved by this new timed flow. The timestamp survives refreshes and is the same for every device.

## Real-time update

Both dashboards already subscribe to Supabase Realtime task changes and refetch their task data. When the admin approves a task, the update publishes its completed status and approval timestamp. The employee board receives that row, calculates remaining time from the timestamp, and updates the countdown once a second until it expires. Expiration only filters the task out of that board view; it does not delete or mutate the task.

## Implementation

- `supabase/migrations/20261013120000_task_kanban_approval_timestamp.sql` adds the nullable approval timestamp.
- `supabase/functions/api/index.ts` stamps approval through the review endpoint, status transition, and admin board transition from submitted to completed; it clears stale timestamps when the task leaves completed status.
- `backend/src/controllers/taskController.js` applies the same timestamp behavior to the Express status and board routes.
- `frontend/src/components/KanbanBoard.jsx` calculates the 60-second window, displays the countdown for employees, and hides expired approved tasks from the employee board only.
- `frontend/src/index.css` styles the compact timer badge.
- `frontend/src/EmployeeDashboard.jsx` and `frontend/src/AdminDashboard.jsx` already subscribe to the tasks table; no new realtime channel is required.

## Rollout

Apply the SQL migration before deploying the updated Edge Function or using the new API code. The migration is additive and leaves existing tasks unchanged. Deploy the updated `api` Supabase Edge Function when the frontend uses the hosted API; running only the local frontend cannot add the database column or change the hosted approval endpoint.
