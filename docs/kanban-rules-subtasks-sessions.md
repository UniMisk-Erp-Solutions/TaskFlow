# Kanban Rules, Admin Timers, Subtask Option, Multi-Device Login and File URL Fix

Date: 16/10/2026. Applies to the web app, the Supabase Edge API, the Express backend and the Flutter app.

## 1. In Progress tasks cannot go back to To Do / Backlog
- Employees can no longer move a task from **In Progress** back to **To Do** or **Backlog** (previously the timer was closed when this happened).
- Enforced in three places: `KanbanBoard.jsx` (`commitMove`, shows an error and cancels the drag), the Edge API `PATCH /tasks/:id/board` and the Express `updateBoardPosition` (HTTP 409), and the Flutter board (move sheet entries disabled + guard in `_requestMove`).
- Admins keep full control of the board.

## 2. Admin Kanban shows every assignee's timer
- Cause: the card only summed sessions of `currentUserId`, so an admin always saw `0`.
- Admin cards in the In Progress column now show the **total tracked time of all assignees** and who is working right now ("Name working" / "Not running"). Employees still see and control their own timer.
- Same behaviour in the Flutter board (live ticking while someone is running).

## 3. "Subtask of" option on the New Task form
- `TaskForm.jsx` has a new optional **Subtask of** select listing open, top-level tasks (no nesting). Picking one switches the title to "New subtask", pre-fills the project and assignees when empty and sends `parent_task_id`.
- Both dashboards pass `parentOptions={tasks}`. The "Add subtask" flow from the detail modal still pre-selects the parent.

## 4. Subtask badge
- A small dashed **SUBTASK** badge appears next to the title in the task table, overview rows, the task detail modal and Kanban cards (web), and as a pill on mobile board cards.

## 5. Multiple devices / browsers at once
- Cause: `supabase.auth.signOut()` defaults to the **global** scope, which revokes every session of the user. Any sign-out (or a failed profile load while signing in on another browser) logged the user out everywhere.
- The server was checked: GoTrue has no single-session setting and keeps one `auth.sessions` row per login.
- Fix: all sign-outs now use `scope: 'local'` (web `AuthContext.jsx`) / `SignOutScope.local` (Flutter `auth_state.dart`), so each browser/device keeps its own session.

## 6. Files download behind Cloudflare
- Probe on production showed `x-forwarded-proto: http` even for https traffic, so signed storage URLs were built as `http://taskflow-backend.unimisk.com/...` and failed.
- `publicStorageUrl` in the Edge API now always uses `https` for real domains (plain `http` is kept only for IP, `sslip.io` and localhost hosts).
- The streaming `/content` endpoints and the in-app preview from the previous change are unchanged. **The web frontend must be redeployed from this branch** for the new download/preview UI to be live.

## Tests
- `TaskForm.test.jsx` covers the parent picker; existing detail-modal and file tests still pass. `flutter analyze` shows no new issues.

## 7. Dead-end "workspace profile could not be loaded" screen
- If `/auth/me` returns 401 (session revoked/expired, e.g. signed out by the old global sign-out in another browser), the app now tries one token refresh and otherwise clears only the local session and returns to the login page instead of showing that error screen.

## 8. AI assistant model fallbacks
- The assistant used to try one model plus one backup, so rate-limited free models showed "The AI is busy". It now tries the configured model, then several other OpenRouter free models in turn (gemma-4-31b, inkling-small, nemotron-3-super, nemotron-3-ultra).
