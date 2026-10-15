# Projects Are Archived, Never Deleted

## Purpose

TaskFlow keeps history. Projects can no longer be deleted; admins **archive** them and can **restore** them later. All tasks, meetings and history stay linked to the project.

## Behavior

- In **Projects** (admin), the delete button is replaced by an **Archive** button with a confirmation that explains nothing is deleted.
- Archived projects disappear from the active list, from project selects and from the Kanban project scope. Employees never see archived projects.
- A collapsible **Archived projects (N)** section at the bottom of the page lists them with the archive date and a **Restore** button.
- Previously, deleting a project unlinked its tasks and meetings. Archiving does not unlink anything.

## API

| Endpoint | Behavior |
|---|---|
| `GET /projects` | Admins receive all projects including `archived_at`; employees only receive active, assigned projects |
| `POST /projects/:id/archive` | Admin only; sets `archived_at` and `archived_by` |
| `POST /projects/:id/unarchive` | Admin only; clears both |
| `DELETE /projects/:id` | Always answers `405` - "Projects cannot be deleted. Archive the project instead." |

Implemented in both the Supabase Edge Function (`supabase/functions/api/index.ts`, `handleProjects`) and the Express backend (`backend/src/controllers/projectController.js`).

## Database

`20261015250000_projects_archive.sql` adds `projects.archived_at`, `projects.archived_by` and a partial index for active projects. It must be applied as the table owner (`supabase_admin` on the self-hosted stack).

## Frontend

`frontend/src/useProjects.js` exposes `projects` (active only), `archivedProjects`, `archiveProject` and `restoreProject`. `ProjectsPanel.jsx` renders the archive dialog and archived section.

## Scope note

Only projects were changed. Tasks, meetings and other records still have their own delete actions.
