# Kanban Individual vs Project Scope (Employee)


- Employees only: admins keep the full board.
- **Project**: only tasks whose `project_id` belongs to the employee's visible project list.
- **Individual** (default): all assigned tasks. Each card carries a pill: folder icon "Project" (hover shows the project name) or person icon "Individual".
- A task whose project was deleted or is not visible is treated as Individual.
- The choice is stored in `localStorage` (`taskflow:kanban-scope`). Existing search, project, priority and assignee filters still apply.

Files: `frontend/src/components/KanbanBoard.jsx`, `frontend/src/index.css`.
