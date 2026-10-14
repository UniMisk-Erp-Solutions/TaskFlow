# Timer Permissions and Team Identity

## Reported symptoms and root cause

The employee portal showed `Admin access required` when starting or pausing a timer, while the checked-in Express timer routes and Supabase Edge API do not apply an admin-only middleware to timer actions. Both APIs authorize employees by task assignment and store each timer row under the authenticated user's ID. The frontend is configured to call the hosted API at `taskflow-backend.unimisk.com/functions/v1/api`, so an admin-only response means the hosted API is running a different/older route implementation than this repository. The admin Kanban `Task not found` banner is returned by the board persistence request when the hosted API cannot find the task in the signed-in admin's organization; because the card is already present in the org-scoped board data, this mismatch likewise points to API version/access-scope drift (or a task changed/deleted after the board loaded), not a missing database timer table.

## Timer authorization contract

- Employees can start and pause only their own timer session on tasks assigned through the legacy `assignee_id` field or the `task_assignees` relation.
- Administrators can start and pause their own session on tasks accessible to them in their organization.
- Each session's `user_id` is always the authenticated caller. Pause updates only that caller's active session, so an employee cannot stop another person's timer.
- Timers remain available on In Progress tasks only for starting; moving a task to Done closes active sessions through the existing board/status workflow.
- Neither the Express routes nor the Supabase Edge route use the admin-only middleware for timer start/pause. Deploying the current Edge Function is necessary for hosted behavior to match these rules.

## Team member name resolution

Timer analytics derives participant IDs from tasks visible in the current organization and from their timer sessions. Older profile rows can have a missing `profiles.org_id`, so filtering the profile-name lookup strictly by `org_id` silently dropped those names and the UI rendered the generic `Team member` fallback. Both APIs now resolve profiles by the referenced IDs, then return only profiles belonging to the current organization or legacy profiles without an organization. Profiles explicitly linked to another organization are excluded. The analytics component also uses the loaded organization profile directory as a name fallback; if a referenced profile truly no longer exists, it shows a short unlinked-member identifier instead of pretending the name is known.

## Files and rollout

- `backend/src/controllers/taskController.js` — Express timer authorization and organization-safe profile-name lookup.
- `supabase/functions/api/index.ts` — matching hosted timer routes, access comment, and profile resolution.
- `frontend/src/components/TimerAnalytics.jsx` — directory fallback and clearer unknown-member display.
- `frontend/src/AdminDashboard.jsx` and `frontend/src/EmployeeDashboard.jsx` — pass the loaded profile directory into timer analytics.

No new SQL is required: the existing `task_timer_sessions` migration already supplies timer storage and RLS. Rebuild the frontend and deploy the latest `api` Supabase Edge Function to the project behind `VITE_API_URL` before expecting hosted timer permission fixes to take effect. If a board move still reports Task not found after deployment, refresh the board and verify the task is still in the same organization and has not been deleted or reassigned.
