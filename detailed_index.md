# Detailed Documentation Index

## Project Setup and Architecture

**Document:** [docs/project-setup-and-architecture.md](docs/project-setup-and-architecture.md)

This guide introduces TaskFlow's purpose and major subsystems, then maps the React/Vite frontend, Express API, Supabase Edge API, database, authentication, realtime updates, and storage. It traces how a browser request receives an access token, reaches the configured API base URL, is authorized, reads or updates Supabase data, and returns to shared frontend state. A source map points readers to the dashboards, shared task hook, Kanban board, server routes/controllers/services, Edge Function, and SQL changes.

The guide documents the two supported development modes (frontend with a hosted Edge API, or frontend plus local Express), required and optional environment variables, service-role key handling, database baseline assumptions, migration safety, and optional seed data. It also describes the Render, Docker, and Vercel configuration files and lists common fixes for missing environment values, CORS, API/Supabase mismatches, and migration-related errors.

## Project README and Quick Start

**Document:** [README.md](README.md)

The README is the primary entry point for contributors and operators. It summarizes the product and its user-facing features, including shared Kanban workflow and per-task timers, identifies the frontend/API/data stack, lists prerequisites, and provides copyable commands to clone the repo, install packages, configure frontend and backend environment files, choose between the hosted Edge Function and local Express API, start Vite, and start the Express API. It explains API base paths, essential Supabase settings, optional integrations, the database's existing-schema prerequisite, and relevant security boundaries for public browser keys versus server secrets. It links to the timer guide and identifies the timer-session migration required by timer endpoints.

It also indexes common package scripts, deployment configurations, feature guides, repository directories, and first-step troubleshooting. The README links to the architecture guide for deeper implementation details and to the Kanban guide for task-board review semantics.

## Employee Kanban Submission and Admin Review

**Document:** [docs/employee-kanban-review-submission.md](docs/employee-kanban-review-submission.md)

This feature note specifies the requested employee flow: employees can move assigned work among Backlog, To Do, and In Progress; only an In Progress task can be submitted to Done; and that move first requires confirmation that admin review is needed. Canceling leaves the task untouched, while confirming persists it as submitted/Under review and puts it in the admin review queue. Admin approval changes the task to completed while keeping it in Done, and rejection returns it to In Progress with a rejection status and note.

The document explains the client/API permission boundary, optimistic update and rollback behavior, admin queue and notification integration, the frontend and backend source locations, and the deployment requirement when the frontend points at a hosted Edge Function. It emphasizes that the UI confirmation is not the security boundary: the API must authorize task access and protect admin-only review decisions.

## Kanban Board and Review Workflow

**Document:** [docs/kanban-board-review-workflow.md](docs/kanban-board-review-workflow.md)

This document explains TaskFlow's shared Kanban Board for administrators and employees. It describes the four persisted lanes and how lane state is kept separate from the existing business task status so established dashboards, overdue logic, and approval behavior continue to work.

It records the end-to-end review lifecycle: employees can submit assigned work from In Progress into Done, where it is marked Under review; organization administrators receive a task-update push notification through the existing notification system; approval records the task as completed and leaves it in Done; rejection records the rejected status and returns the task to In Progress. It also covers how the existing reopen flow remains distinct from submission rejection.

The entry documents the compact card design and its high-pink, medium-green, and low-blue full-card priority fills, the uniform white lane surfaces in the light theme, the filters and desktop/touch/keyboard interactions, optimistic persistence and rollback, and task-detail integration. It identifies the frontend hook and components, both API implementations, and the two database migrations for Kanban ordering and rejected status. It also explains the hosted API deployment requirements for shared-backend writes.

## Kanban Drag Permissions and Long-List Scrolling

**Document:** [docs/kanban-drag-permission-and-scrolling.md](docs/kanban-drag-permission-and-scrolling.md)

This diagnosis documents the employee-facing `Admin access required` error. The checked-in Edge Function and Express board routes allow authenticated employees to move tasks they can access, while admin-only review decisions remain protected. Since the frontend is configured for a hosted Edge API and the current board route does not emit that exact admin-guard message, seeing it during a board move indicates that the hosted API policy differs from the repository version. The task hook optimistically changes the lane and restores it when the API rejects the write, which accounts for a card snapping back after a failed drop.

The note also covers the client message that identifies this API mismatch and the viewport-edge auto-scroll added to make the last cards of long columns reachable during native drag and drop. It maps these behaviors to the Kanban component, shared task hook, Edge Function, Express controller and route, and deployment script. The hosted permission fix requires deploying the current Edge Function to the linked Supabase project; local code changes alone do not alter that service.

## Portal Routes and Priority Colors

**Document:** [docs/portal-routes-and-priority-colors.md](docs/portal-routes-and-priority-colors.md)

This guide enumerates the separate, bookmarkable page routes for every existing admin and employee sidebar feature. It explains how the portal dashboards read React Router location to render the selected page, how sidebar actions update the URL, how `/admin` and `/dashboard` redirect to default pages, and how the existing route guards continue to protect role-specific areas.

The guide also records the shared high-pink, medium-green, low-blue palette for Kanban full-card fills and priority badges in task and meeting views. It identifies the router, dashboard components, sidebar, Kanban color helper, badge component, and CSS as the implementation points, and clarifies that route and palette changes do not alter SQL data or review behavior.

## Kanban Column Surface and Board API 404

**Document:** [docs/kanban-column-surface-and-api-404.md](docs/kanban-column-surface-and-api-404.md)

This note describes the uniform theme-panel background used by all Kanban lanes, with the light theme appearing white; task card priority fills remain unchanged. It diagnoses the admin drag `Not found` response by tracing the frontend PATCH request to the board handler in the current Edge Function. The generic response is the function's unmatched-route fallback, while task lookup failures in the current handler have task-specific messages, indicating the hosted function likely predates the board-move route.

The document explains that deploying the current `api` Edge Function to the frontend's Supabase project is the fix for the missing route, and that SQL is not required for this specific 404 because the board and lane data already load. It lists the CSS, Kanban helper/component, Edge API, and deployment script involved.

## Kanban Drop Target and Scroll Fix

**Document:** [docs/kanban-drop-target-and-scroll-fix.md](docs/kanban-drop-target-and-scroll-fix.md)

This historical feature note records the initial attempt to address the native browser prohibited-drop cursor and dragging lower cards in long columns. It explains that setting `effectAllowed` on the card is not enough: valid targets also prevent the default drag-enter/drag-over behavior and set `dataTransfer.dropEffect` to `move`. The lane surface accepted drops over blank space, while card insertion targets allowed ordering before a specific card. That native approach did not eliminate the cursor issue in the reported case and was superseded by pointer-based hit detection; see the current implementation entry below.

The note also describes the admin/employee scroll-container difference. The shared helper finds and scrolls the nearest vertical overflow container near its top or bottom edge, with a viewport fallback. Persistence uses the existing shared task hook and backend endpoint, so role-based access and employee review transitions remain unchanged.

## Kanban Pointer-Based Drop Targets

**Document:** [docs/kanban-pointer-drop-targets.md](docs/kanban-pointer-drop-targets.md)

This guide documents replacing native HTML drag-and-drop with pointer-driven drag tracking because browser native hit-testing showed a prohibited cursor and failed to recognize lower-position drops. It explains the small movement threshold that preserves ordinary click-to-open behavior, pointer-coordinate target detection across the full lane, before/after card insertion, appending when dropping elsewhere in the lane, cancellation outside the board, and suppression of the synthetic click after a move. A floating card preview follows the pointer via direct transforms in an animation-frame loop, leaving the source as a dimmed placeholder and avoiding a full board render for every pointer event. The same loop drives smooth edge auto-scroll, a clear target-lane outline, and precise before/after or append markers. It also explains why all four grid lanes stretch to the tallest lane: shorter destination lanes must extend to the lower vertical positions occupied by cards in long lanes, or there is no lane element to receive the drop at that coordinate.

The interaction supports mouse and pen from the card surface and touch drags from the visible grip, leaving ordinary touch swipes available for board scrolling. Edge auto-scroll keeps long lists reachable. A move still goes through the existing `commitMove`/`onMoveTask` flow, preserving optimistic updates and rollback, server authorization, saved ordering, and the employee Under review submission path. The entry lists the component, styling, shared task hook, and backend implementations, and notes that no database migration is involved.

## Approved Task Done-Lane Countdown

**Document:** [docs/kanban-approved-task-countdown.md](docs/kanban-approved-task-countdown.md)

This feature guide describes how an approved task remains visible in the employee Kanban Done lane for 60 seconds, displays a small remaining-time badge, and then disappears from that lane only. The task remains completed in shared task data and continues to appear in task lists, totals, reports, and history. Existing completed tasks without an approval timestamp stay visible, and the admin Kanban board is not subject to the employee countdown.

The countdown is calculated from the persisted nullable `tasks.kanban_approved_at` timestamp, written by admin approval paths in both the Supabase Edge API and Express board/status handlers. Existing task-table realtime subscriptions refetch the approved task for employees; the board updates the timer every second and filters expired approved cards without changing server data. The guide lists the migration, API handlers, board component, and timer styling, and gives the deployment order: run the additive migration, then deploy the updated hosted Edge Function when using that API.

## Task Timer Tracking and Analytics

**Document:** [docs/task-timer-tracking-and-analytics.md](docs/task-timer-tracking-and-analytics.md)

This feature guide documents persistent, per-task, per-person timer intervals shared by the Admin and Employee portals. It explains the Start/Pause controls shown on In Progress Kanban cards, server and database enforcement that prevents timers from starting outside that lane, how pause/resume is represented as separate persisted sessions, and how every active session for a task is closed when the task enters Done (including employee submission for review). A database trigger makes the close atomic with the task lane update, while both API implementations also perform the close explicitly after board moves.

The guide describes the dedicated `/admin/timer` and `/dashboard/timer` pages, the dotted graph covering every task with tracked time, role-specific per-task and person/task tables, and the average tracked completion time for administrators (completed tasks without timer data are excluded). It details elapsed-time calculation, Realtime refresh, organization and assignment scoped API reads, caller-owned start/pause permissions, and the Supabase RLS policy. It maps the React hook, Kanban card, analytics component, both APIs, and SQL migration. The rollout section says to apply `supabase/migrations/20261014130000_task_timer_sessions.sql` and deploy the updated Supabase Edge Function when using the hosted API; it states that this workspace change did not run the migration against a hosted database or deploy the API.

## Profile Pages and Self-Service Account Details

**Document:** [docs/profile-pages-and-self-service-details.md](docs/profile-pages-and-self-service-details.md)

This guide documents the dedicated Profile page available to both administrators and employees. It covers the role-specific `/admin/profile` and `/dashboard/profile` routes, the sidebar navigation item and identity shortcut, and the responsive page layout that surfaces account identity, role, workspace, membership date, and account status.

It explains the self-service form behavior: a user can update their own full name and phone number, while email, role, organization membership, and account status are shown as read-only account details. After a successful save, the authenticated profile is refreshed so the dashboard greeting and sidebar immediately reflect the new name. Inline feedback handles successful and failed saves.

The entry maps the frontend page, both dashboard routers, the Express API route/controller, and the Supabase Edge Function handler. Both API implementations validate the editable fields and target only the authenticated profile ID, so role and organization fields cannot be changed through this endpoint. The feature uses existing profile columns and therefore needs no SQL migration; hosted installations must deploy the updated Edge Function for the hosted profile save to become available.
