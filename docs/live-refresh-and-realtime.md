# Live Task Refresh and Realtime Publication


## Problem

After an employee sent a task for review, the admin only saw it after a manual refresh.

## Behavior

- `frontend/src/useRealtime.js` gains `useLiveRefresh(callback, intervalMs = 5000)`. It refreshes while the tab is visible, on `focus`, and on `visibilitychange`.
- `useTasks` and `useProjects` accept `{ silent: true }`: no loading spinner is shown and the current list is kept if the request fails.
- `AdminDashboard.jsx` and `EmployeeDashboard.jsx` use silent refetches for realtime events and call `useLiveRefresh` to refresh tasks, projects, and timer sessions.

## Database

`supabase/migrations/20261014150000_realtime_task_tables.sql` adds `tasks`, `task_assignees`, `meetings`, and `meeting_assignees` to the `supabase_realtime` publication when they are not already members. It is idempotent. The production TaskFlow database already had these tables published, so only the polling fallback was required there.

## Notes

If the websocket proxy blocks `wss://.../realtime`, polling alone keeps the UI current.
