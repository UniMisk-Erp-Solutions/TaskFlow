# Kanban Drop Target and Scroll Fix

> Historical implementation note: native drag acceptance was later replaced after the prohibited cursor continued to appear for lower-card drops. The current behavior is documented in [Kanban Pointer-Based Drop Targets](kanban-pointer-drop-targets.md).

## Purpose

Fix the browser's prohibited-drop cursor and make cards near the bottom of long Kanban columns reachable in both admin and employee portals.

## Drag acceptance

Task cards start native HTML drag operations with `effectAllowed` set to `move`. The board now explicitly sets `dataTransfer.dropEffect` to `move` and calls `preventDefault()` from both `dragenter` and `dragover` on the full lane and each card insertion target. The browser therefore recognizes the whole lane, including empty space, as a valid drop area. Dropping on a card reorders before that card; dropping elsewhere in the lane appends the card. Employee moves to Done still use the existing review confirmation and role checks.

## Scrolling long columns

The previous auto-scroll behavior always scrolled `window`. The admin portal scrolls its dashboard content in an inner element, so dragging a card near the visible panel edge did not scroll that panel. The shared `autoScrollAtPointer` helper now finds the nearest vertically scrollable ancestor and scrolls it when the pointer enters the top or bottom edge zone. It falls back to the document viewport when the page itself is the scroll container. The helper is used by both native desktop drag events and the existing touch pointer-drag path.

## Persistence and permissions

Drop handling still calls the shared task move handler, which optimistically updates the board, sends the existing `PATCH /tasks/:id/board` request, and restores the previous lane when the API rejects the write. The change affects browser drag acceptance and scrolling; it does not weaken backend task-access checks, change SQL, or bypass employee review when submitting work to Done.

## Source files

- `frontend/src/components/KanbanBoard.jsx`: drop-effect acceptance, lane/card drag event handlers, and shared scroll-container detection.
- `frontend/src/useTasks.js`: existing shared persistence and rollback path.
- `supabase/functions/api/index.ts` and `backend/src/controllers/taskController.js`: existing server-side access control and workflow transitions.
