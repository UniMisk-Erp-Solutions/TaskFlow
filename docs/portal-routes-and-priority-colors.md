# Portal Routes and Priority Colors

## Purpose

TaskFlow's admin and employee dashboards now expose each existing sidebar feature as a distinct, addressable page. This makes pages directly linkable and keeps browser back, forward, refresh, and bookmarks aligned with the selected feature. The shared priority palette is also updated to high pink, medium green, and low blue.

## Routes

| Portal | Page | Route |
| --- | --- | --- |
| Admin | Overview | `/admin/overview` |
| Admin | Tasks and meetings | `/admin/tasks` |
| Admin | Kanban Board | `/admin/kanban` |
| Admin | Calendar | `/admin/calendar` |
| Admin | Projects | `/admin/projects` |
| Admin | Users | `/admin/users` |
| Admin | Notifications | `/admin/notifications` |
| Admin | Reminders | `/admin/reminders` |
| Employee | Tasks | `/dashboard/tasks` |
| Employee | Kanban Board | `/dashboard/kanban` |
| Employee | Calendar | `/dashboard/calendar` |
| Employee | Projects | `/dashboard/projects` |
| Employee | Notifications | `/dashboard/notifications` |

The legacy portal entry paths `/admin` and `/dashboard` redirect to their default pages. Protected route guards still enforce the admin and employee role rules. Sidebar navigation changes the URL, and dashboard content derives its selected page from that URL, so direct links and browser navigation render the same view as sidebar clicks.

## Priority palette

- **High:** pink (`#db2777`).
- **Medium:** green (`#16a34a`).
- **Low:** blue (`#2563eb`).

Kanban full-card fills use these colors, and priority badges in the shared task and meeting tables use matching palette classes. Kanban lane surfaces use a uniform theme panel color (white in the light theme). Status badges retain their separate status meanings.

## Implementation

- `frontend/src/App.jsx` adds protected wildcard portal routes and default redirects.
- `frontend/src/AdminDashboard.jsx` and `frontend/src/EmployeeDashboard.jsx` derive the active feature from React Router location and navigate per feature.
- `frontend/src/components/Sidebar.jsx` provides route-driven navigation labels for the existing portal sections.
- `frontend/src/lib/kanban.js`, `frontend/src/components/StatusBadge.jsx`, and `frontend/src/index.css` define the shared priority colors for cards and badges.

These are client-side routes and visual changes. They do not change task data, API permissions, SQL schema, or review workflow behavior.
