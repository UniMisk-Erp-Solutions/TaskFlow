# Project Edit/Delete and Employee Project Scoping


## Admin

- Pencil and trash buttons on each project card open an edit dialog (name, description) or a delete confirmation.
- `PATCH /projects/:id` updates name/description; `DELETE /projects/:id` removes the project. Both are admin-only and organization-scoped.
- Deleting unlinks the project's tasks and meetings (`project_id = null`) before removing the project; no tasks or meetings are deleted.

## Employees

`GET /projects` returns only projects that have at least one task or meeting assigned to the employee (via `assignee_id` or the assignee junction tables). Admins still receive every organization project.

## Frontend

`useProjects` exposes `updateProject` and `deleteProject` and supports silent refetch. Admin dashboard refreshes tasks after changes; both dashboards refresh projects with the live refresh loop. The Kanban Project scope uses the same project list.

## Rollout

Redeploy the `api` Edge Function (or backend). No SQL is required: `tasks.project_id` already uses `ON DELETE SET NULL`.
