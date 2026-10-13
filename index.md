# TaskFlow Documentation Index

- [Project Setup and Architecture](docs/project-setup-and-architecture.md) — Describes the application structure, frontend/API/Supabase data flow, configuration, local run modes, database prerequisites, and deployment setup.
- [README](README.md) — Quick start, prerequisites, API mode configuration, run commands, feature overview, and common troubleshooting for the complete project.
- [Employee Kanban Submission and Admin Review](docs/employee-kanban-review-submission.md) — Documents employee lane permissions, the Done confirmation, Under review queueing, admin approval, and rejection behavior.
- [Kanban Board and Review Workflow](docs/kanban-board-review-workflow.md) — Documents the shared task board, priority-tinted cards, employee submissions, admin review, rejection behavior, and the backend rollout requirements.
- [Kanban Drag Permissions and Long-List Scrolling](docs/kanban-drag-permission-and-scrolling.md) — Explains why employee drops can show an admin-only API error, how failed optimistic moves appear to snap back, and how drag scrolling works for long columns.
- [Portal Routes and Priority Colors](docs/portal-routes-and-priority-colors.md) — Lists the distinct admin and employee page URLs and documents the high-pink, medium-green, low-blue priority palette.
- [Kanban Column Surface and Board API 404](docs/kanban-column-surface-and-api-404.md) — Documents the uniform white lane surfaces and why the admin drag error requires deploying the current Supabase Edge API route; no SQL is needed for that 404.
- [Kanban Drop Target and Scroll Fix](docs/kanban-drop-target-and-scroll-fix.md) — Records the earlier native drag acceptance attempt and links to the current pointer-based approach.
- [Kanban Pointer-Based Drop Targets](docs/kanban-pointer-drop-targets.md) — Documents pointer-following previews, insertion markers, smooth edge scrolling, and full-height lane drop targets for the Kanban board.
- [Approved Task Done-Lane Countdown](docs/kanban-approved-task-countdown.md) — Explains the 60-second employee Kanban countdown after admin approval and the additive database/API rollout needed to keep it real-time across refreshes.
