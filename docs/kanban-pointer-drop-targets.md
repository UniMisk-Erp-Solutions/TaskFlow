# Kanban Pointer-Based Drop Targets

## Purpose

Make every Kanban lane accept a card dropped anywhere inside its visible column, including when the source card is near the bottom of a long list. This removes the browser's native prohibited-drop cursor and applies the same interaction to desktop, touch, and pen pointers.

## Interaction

Task cards no longer start native HTML drag sessions. A primary-pointer press starts tracking; movement must pass a small threshold before it is considered a drag, so an ordinary click still opens the existing task detail view. Mouse and pen can start from the card surface; touch drags start from the visible grip so swiping elsewhere on the card continues to scroll the board. Once dragging, the board resolves the release point with `document.elementFromPoint`, finds the containing lane, and submits the existing board move. Dropping over another card inserts before or after it based on the pointer's vertical position; dropping on any other part of the lane appends the task to that lane. Releasing outside the board or cancelling the pointer leaves the task where it was.

All four grid lanes stretch to the tallest lane in the row. This keeps a short or empty destination lane physically present at the same vertical coordinate as cards near the bottom of a long source lane, so the pointer can still resolve the destination column at that lower position.

The source card stays in the list as a dimmed placeholder, and a floating preview follows the pointer. Preview movement uses direct transforms updated in an animation-frame loop, rather than re-rendering the board for every pointer event. The destination lane receives a clear focus outline, with a line marker before/after the hovered card or an append outline at the bottom. Edge auto-scroll runs steadily in the same frame loop for smooth movement through long columns. A post-drag click is consumed so the browser's synthetic click cannot open task details after a move.

## Workflow and persistence

All moves continue through the current `commitMove` and shared `onMoveTask` path. This preserves optimistic updates and rollback on API errors, task access rules, saved lane ordering, and the employee confirmation/review workflow when submitting an In Progress task to Done. This change does not add or change database columns and does not bypass backend authorization.

## Implementation map

- `frontend/src/components/KanbanBoard.jsx` — pointer threshold, animation-frame hit detection/scrolling, insertion target selection, floating preview, click suppression, and drag cancellation.
- `frontend/src/index.css` — source placeholder, floating preview, insertion/append markers, drop-target focus, and equal-height lane hit areas.
- `frontend/src/useTasks.js` — existing persistence and rollback path used by the board.
- `supabase/functions/api/index.ts` and `backend/src/controllers/taskController.js` — existing server-side move authorization and review transitions.

## Verification

The frontend production build completes with `npm run build`. Vite reports its existing warning that the generated JavaScript chunk is larger than 500 kB; it does not fail the build.
