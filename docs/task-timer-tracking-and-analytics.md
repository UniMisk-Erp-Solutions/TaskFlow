# Task Timer Tracking and Analytics

## Purpose

TaskFlow now records focused work time as resumable timer sessions attached to both a task and the signed-in person. Employees and administrators can start or pause their own timer from an In Progress Kanban card. Both portals have a dedicated **Timer** page that reads the same persisted sessions; the administrator view groups time by assigned person and task, while an employee sees only their own task time.

The timer is part of the existing task system. It uses the existing task identifiers, task assignments, Kanban lane, task status, auth profile, organization, and realtime channel rather than creating duplicate tasks or a separate work tracker.

## Timer behavior

- A timer can start only when its task is in the `in_progress` Kanban lane. This is checked by both API implementations and a database trigger.
- Each Start creates one interval for the authenticated user and task. A partial unique index prevents that user from opening duplicate active intervals for the same task. Repeated Start requests return the already active interval.
- Pause closes that interval with `ended_at`. Starting again creates a new interval, so pauses do not count toward tracked time and history remains auditable.
- The card shows the signed-in person's accumulated time for that task and a Start/Pause control while the task is In Progress. The displayed clock advances once per second.
- Moving a task into Done closes all active sessions for that task, including sessions started by other assignees. A database trigger performs this within the task update transaction, covering moves from both portals and other task update paths. The API also attempts an explicit close after a successful board move for clear application-level behavior.
- Employee submission for review also closes active intervals because it moves the task into Done/Under review. Admin approval keeps the recorded intervals closed.

## Analytics

The Timer page summarizes total tracked time, currently running sessions, tasks with time, and (for administrators) people represented in the sessions. A dotted point-and-line graph plots every task with recorded time; its horizontal scroll keeps each task point available on large workspaces. The table lists individual task durations for employees and person/task pairs for administrators. Administrator averages divide a person's tracked seconds on completed tasks by that person's number of completed assigned tasks with recorded time; untracked tasks do not make the average appear as zero. A person with no completed tracked task has no average yet.

Elapsed time is computed from `started_at` to `ended_at`, or from `started_at` to the current client time for a running interval. The API scopes sessions to the current organization and visible tasks. Employee requests are restricted to tasks assigned to that employee and sessions owned by that employee. Administrator results use the existing assignee-scoped task visibility rules. Timer rows and active clocks refresh through Supabase Realtime; the UI also ticks active elapsed time locally each second.

## Implementation map

- `frontend/src/components/KanbanBoard.jsx` adds the per-card controls and live elapsed value.
- `frontend/src/useTaskTimers.js` loads analytics, starts/pauses sessions, and refreshes from Realtime.
- `frontend/src/components/TimerAnalytics.jsx` renders the role-specific summaries, dotted task graph, averages, and task/person table.
- `frontend/src/lib/taskTimer.js` contains shared duration calculations and formatting.
- `frontend/src/components/Sidebar.jsx`, `AdminDashboard.jsx`, and `EmployeeDashboard.jsx` add the Timer navigation item and separate `/admin/timer` and `/dashboard/timer` pages.
- `supabase/functions/api/index.ts` implements the hosted API endpoints; `backend/src/routes/tasks.js` and `backend/src/controllers/taskController.js` implement the equivalent local Express endpoints.
- `supabase/migrations/20261014130000_task_timer_sessions.sql` creates the session table, indexes, read policy, Realtime publication entry, and database triggers that validate starts and close sessions on Done.

## API operations

- `GET /tasks/timer-analytics` returns the caller-visible task timer sessions and participant profiles.
- `POST /tasks/:id/timer/start` starts or returns the caller's active interval, provided the caller can access the task and it is In Progress.
- `POST /tasks/:id/timer/pause` closes the caller's active interval for that task.

The APIs use the existing authenticated task access checks. Employees cannot read other employees' timer sessions or start/pause a task they are not assigned to. The database table has RLS enabled, authenticated users have read access only through the row policy, and writes are performed by the trusted API service role.

## Database and deployment

Before using timers on a Supabase-backed environment, apply `supabase/migrations/20261014130000_task_timer_sessions.sql` to the same Supabase project used by the application. The migration is additive and does not alter existing task status values or task rows. Deploy the updated `api` Supabase Edge Function when the frontend points to a hosted API. For a local Express API, restart the backend after pulling the changes. Then restart or refresh the frontend.

The migration and API source are checked into the feature branch; they are not applied to a hosted database or deployed automatically by this code change. If the migration has not run, timer endpoints will report a database relation error until it is applied.

## Verification

The frontend production build completed with Vite. The Express task controller and route passed Node syntax checks. The Supabase migration was reviewed but not executed against a hosted database, and no live database or cross-account realtime test was run in this workspace.
