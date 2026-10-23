# Kanban Board and Review Workflow

## Purpose

TaskFlow's Kanban Board is a second view of the existing tasks, available to both administrators and employees. It keeps the task list and board synchronized instead of creating a separate task system. The board is designed to make task progress visible, support drag-and-drop planning, and preserve the existing admin review process.

## Board behavior

The board has four persisted lanes:

- **Backlog** — planned or blocked work.
- **To Do** — work ready to start.
- **In Progress** — active work, including work returned after a review rejection.
- **Done** — completed work and employee submissions awaiting admin review.

Lane and order are stored separately from business status in `tasks.kanban_column` and `tasks.kanban_order`. This separation preserves status-based dashboards, overdue handling, and review semantics while allowing Backlog and To Do to both map to the existing `pending` business status.

| Board action | Stored task status | Lane |
| --- | --- | --- |
| Employee moves an assigned task into In Progress | `in_progress` | `in_progress` |
| Employee moves an In Progress task into Done | `submitted` | `done` |
| Admin approves the submission | `completed` | `done` |
| Admin rejects the submission with a review note | `rejected` | `in_progress` |
| Admin reopens a completed task through the existing reopen flow | `changes_requested` | `backlog` |

Employees must move a task into In Progress before submitting it to Done from the board. Submitted work stays in Done with an **Under review** badge and cannot be moved out by dragging. The task details review actions let an admin approve or reject it. Approval keeps it in Done; rejection returns it to In Progress with a **Rejected** badge and the review note in the task history.

Employees can move active tasks freely among Backlog, To Do, and In Progress. When an employee drags a task from In Progress to Done, the board first opens an **Admin review needed** confirmation. Canceling keeps the task in In Progress without sending an API update. Confirming persists the move as `submitted` and Done, shows the **Under review** badge, and makes the task available from the admin **Review** queue. The board move APIs authorize the signed-in employee against assignment/task access; they do not require the employee to have the admin role. Only review decisions remain admin-only.

## Review notifications

When an employee submits from the board, the API looks up administrators in the task's organization and includes them in the existing `task_update` push notification. The notification title is **Task ready for review** and links to the task. The existing TaskFlow push preference and browser subscription settings determine whether an administrator receives a browser push. The admin dashboard's pending-review count also derives from tasks in `submitted` status.

Tasks can also reach `submitted` automatically when an assigned employee's GitHub push or pull request references the task; they use the same review notification and admin actions. See [github-integration.md](github-integration.md).

## Priority card design

All four lane surfaces use the same theme panel color (white in the light theme). Lane background colors do not vary by workflow; task priority remains visible through the card fills and priority badges.

Kanban cards use a light full-card tint based on task priority rather than a colored left stripe:

- High — pink tint.
- Medium — green tint.
- Low — blue tint.

Cards stay compact and omit task descriptions. They show the title, priority, project, assignees, due date when present, and review or rejection status when relevant.

## User interface and interactions

- Admin and employee sidebars both link to the same board component at their own direct routes (`/admin/kanban` and `/dashboard/kanban`).
- The board supports search and project, priority, and assignee filters over the role-visible task set.
- Desktop uses native drag-and-drop with explicit move drop effects on both card targets and the full lane surface, allowing lane moves and card reordering. Touch users can drag from the card grip; keyboard users can focus a card and use the left/right arrow keys to move between lanes. Dragging near a scroll edge scrolls the nearest portal content container so lower cards remain reachable.
- Task cards open the existing task details and review experience.
- The board applies optimistic moves, persists through the task hook, restores the prior task if the API rejects a move, and displays the returned error.
- Employee dashboard content uses the available main-area width, with responsive board lanes and sidebar behavior on smaller screens.

## Backend and data changes

The Supabase Edge API implements authenticated `PATCH /tasks/:id/board`. It validates the lane and order, checks organization and task access, limits employee moves to their accessible tasks, preserves admin visibility rules, and maps lane changes into the existing business lifecycle. Employee submission does not mark a task completed; only the admin approval endpoint can do that.

The Express task router/controller also exposes the board position endpoint and applies the same employee submission guard and workflow mapping for installations using that API.

The Edge API's `/tasks/:id/board` handler is present in the repository. If a board move receives the generic `Not found` response while task lists and the board load, the deployed API does not have the matching PATCH route version. The current handler returns task-specific messages for row lookup failures. Deploy the current Edge Function to the Supabase project serving the frontend. This route update does not require a new SQL migration for the reported 404.

Migrations:

- `supabase/migrations/20261012120000_task_kanban_board.sql` adds the lane and fractional order columns, constrains lane values, backfills existing tasks from their business statuses, and adds the organization/lane/order index.
- `supabase/migrations/20261012130000_task_review_rejected_status.sql` adds `rejected` to the existing task status enum when needed.

The frontend persists ordering as a fractional rank, allowing a task to be inserted between neighboring tasks without rewriting the whole lane.

## Deployment note

The local frontend is configured to call the deployed TaskFlow Edge API. Source changes alone do not update that shared API or database. Apply the migrations and deploy the updated Edge function before expecting board moves, review notifications, or the rejected status to work against the deployed service. No remote database migration or API deployment was performed as part of the local code changes.

## Implementation files

- `frontend/src/components/KanbanBoard.jsx` — board columns, filters, cards, native/touch/keyboard interactions, and error handling.
- `frontend/src/lib/kanban.js` — lane mapping, ordering helpers, and priority colors.
- `frontend/src/useTasks.js` — optimistic board updates and rollback on persistence errors.
- `frontend/src/components/TaskDetailModal.jsx` — admin approval and rejection actions.
- `frontend/src/components/StatusBadge.jsx` and `frontend/src/index.css` — review/status badges and priority-based card fills.
- `supabase/functions/api/index.ts` — Edge API access checks, task lifecycle transitions, audit history, and review notifications.
- `backend/src/controllers/taskController.js` and `backend/src/routes/tasks.js` — Express API parity.

## Verification performed

- `npm run build` in `frontend` completed successfully. Vite reported the existing large JavaScript bundle advisory.
- `node --check backend/src/controllers/taskController.js` completed successfully.
