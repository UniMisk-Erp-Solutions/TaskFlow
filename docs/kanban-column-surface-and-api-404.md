# Kanban Column Surface and Board API 404

## User visible changes

All four Kanban lane surfaces now use the same theme panel color, which is white in the light theme. Lane tops and drop-target fills no longer use a different color per workflow lane. Priority card backgrounds and priority badges are unchanged by this lane-surface adjustment.

## Admin move error diagnosis

The admin board screenshot shows the generic `Not found` response after a drag. The frontend sends `PATCH /tasks/:id/board`. That route exists in the current repository's Supabase Edge Function and Express API. The Edge Function's final fallback returns the exact generic message `Not found` when no handler matches the request method and path. The current board handler returns task-specific errors for missing or inaccessible rows, rather than this generic fallback.

The evidence therefore points to the API deployment serving the frontend not yet containing the board-move PATCH route. This is consistent with the board and task list loading successfully while board writes return `Not found`. The client now explains that the hosted API endpoint needs updating. Deploy the current `api` Supabase Edge Function to the same project used by the frontend to enable moves.

This route deployment does not require SQL for the reported 404. The current board and lane data already load, and the missing route is application code. Existing task access and workflow checks in the current board handler remain in effect after deployment.

## Implementation locations

- `frontend/src/index.css`: uniform lane panel surface and neutral lane border; priority card rules remain independent.
- `frontend/src/lib/kanban.js`: removed per-lane color accents.
- `frontend/src/components/KanbanBoard.jsx`: displays an actionable explanation for the API's generic `Not found` response.
- `supabase/functions/api/index.ts`: current authenticated board-move endpoint.
- `scripts/deploy-edge-api.sh`: deploys the `api` Edge Function after the project is linked and Supabase CLI is authenticated.
