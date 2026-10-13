# Kanban Drag Permissions and Long-List Scrolling

## Purpose

This note covers two issues reported in the employee Kanban Board: task drops failing with `Admin access required`, and dragging cards at the bottom of long columns being difficult or appearing stuck.

## Permission diagnosis

The frontend is configured to call the hosted Supabase Edge API. In the checked-in Edge Function, `PATCH /tasks/:id/board` calls the task access check, permits an employee to update an assigned task, and only reserves review approval or rejection for administrators. The Express route follows the same policy: its board endpoint uses authentication and task access checks, without the admin middleware. The literal `Admin access required` response belongs to the shared admin-only guard and is not returned by either current board route.

Therefore, when the hosted request returns that exact message during an employee board move, the hosted API deployment is enforcing a different version or route policy from the current repository. The browser optimistically shows the new lane, then `useTasks` restores the saved task after the API rejects the request. This rollback explains why a card appears to move and then snap back or stick at the drag destination. The source fix alone cannot update the hosted service; the Edge Function needs to be deployed and the employee board move retried.

The current client now translates this specific stale-policy response into an actionable message. Other API errors are shown as returned. This preserves the server as the authority for task assignment checks and admin review decisions.

## Long-column drag behavior

The board uses native HTML drag and drop. When a drag passes through the top or bottom 72 pixels of the viewport, the board now scrolls the page in small steps. This makes cards near the bottom of a long lane reachable without dropping the card or restarting the drag. Drop targets still persist the destination lane and ordering through the shared task API.

## Review workflow remains unchanged

Employees may move assigned tasks among Backlog, To Do, and In Progress. Moving an In Progress task to Done prompts for review; confirmation stores it as submitted/Under review. Administrators approve it to complete it or reject it to return it to In Progress. Backend task access and admin-only review controls remain authoritative.

## Source locations

- `frontend/src/components/KanbanBoard.jsx`: employee-visible API mismatch message and viewport-edge scrolling during drag.
- `frontend/src/useTasks.js`: optimistic lane update and restoration after an API failure.
- `supabase/functions/api/index.ts`: hosted Edge API board permission and review workflow.
- `backend/src/routes/tasks.js` and `backend/src/controllers/taskController.js`: local Express board endpoint and permission behavior.
- `scripts/deploy-edge-api.sh`: deploys the `api` Edge Function after the Supabase project is linked and the CLI is authenticated.

## Verification and rollout

Run the frontend production build to check the client change. To enable employee moves against the configured hosted API, deploy the current `api` Edge Function to the linked Supabase project, then retry moving an assigned task between Backlog, To Do, and In Progress. Submission to Done should continue to require confirmation and enter the admin review queue.
