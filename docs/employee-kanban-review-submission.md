# Employee Kanban Submission and Admin Review

## Purpose

This document describes the employee-side Kanban move rules and how the task progresses through administrator review. The board remains a view of the existing TaskFlow tasks; submission changes the existing task's workflow status and lane rather than creating a separate board item.

## Employee lane moves

Employees may drag assigned tasks between **Backlog**, **To Do**, and **In Progress** without admin privileges. The board calls the task board-position endpoint, which checks that the signed-in employee can access the task. A move from Backlog or To Do straight to Done is blocked with an instruction to move the task into In Progress first.

When an employee drags a task from **In Progress** to **Done**, the browser shows an **Admin review needed** confirmation. The message explains that the task will be marked Under review, an administrator must approve it before completion, and a rejection will return it to In Progress. Choosing **Keep in In Progress** cancels without changing the task. Choosing **Send for admin review** submits the move.

## Submission and review lifecycle

1. The board asks the employee to confirm the review submission before sending the move.
2. The API validates the employee's task access and current board lane, then stores `status = submitted` and `kanban_column = done`.
3. The task remains visible in Done with an **Under review** status badge. The task is included in the admin pending-review count, and the admin **Review** button opens the Tasks view filtered to submitted work.
4. An admin approves the task from the review experience. The API stores `status = completed` and keeps it in Done. The employee's board and task list show the completed status after refresh or realtime update.
5. If an admin rejects the task and provides a note, the API stores `status = rejected` and `kanban_column = in_progress`. The employee sees it return to In Progress with a **Rejected** badge and the reviewer note in task history.

## Permission boundaries

- Employees may update the lane/order of tasks they are allowed to access. Board movement between Backlog, To Do, and In Progress does not require the admin role.
- An employee may submit to Done only from In Progress. The frontend confirmation is a usability step; the API repeats the status/lane and task-access checks, so a direct HTTP request cannot bypass the workflow.
- Only admins can approve or reject a submitted task. Employees cannot directly mark their work completed or move a submitted task out of Done.
- These rules are implemented in both the Express board-position controller and the Supabase Edge Function board handler. The Edge Function also implements the submit, approve, and request-changes endpoints used by the review UI.

## Source map

- `frontend/src/components/KanbanBoard.jsx` gates employee movement to Done behind the confirmation and reports API failures.
- `frontend/src/EmployeeDashboard.jsx` passes the employee role to the shared board; `frontend/src/AdminDashboard.jsx` enables admin board behavior.
- `frontend/src/useTasks.js` applies the move optimistically and restores the previous task if persistence fails.
- `backend/src/controllers/taskController.js` validates employee task access and the In Progress to Done submission transition for board moves.
- `supabase/functions/api/index.ts` persists lane/status changes, logs task history, notifies organization admins on submission, and enforces admin-only approval/rejection.
- `frontend/src/AdminDashboard.jsx` counts submitted tasks and opens the filtered review queue; the task review actions approve or return submitted work to In Progress.

## Deployment note

The local frontend uses the API URL configured in `frontend/.env.local`. If that URL points to a hosted Edge Function, deploy the updated `supabase/functions/api/index.ts` to that Supabase project before expecting its server-side employee permissions to change. The new confirmation UI runs in the frontend; the API remains authoritative for task access, submission status, and admin review.
