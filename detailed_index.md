# Detailed Documentation Index

## Kanban Board and Review Workflow

**Document:** [docs/kanban-board-review-workflow.md](docs/kanban-board-review-workflow.md)

This document explains TaskFlow's shared Kanban Board for administrators and employees. It describes the four persisted lanes and how lane state is kept separate from the existing business task status so established dashboards, overdue logic, and approval behavior continue to work.

It records the end-to-end review lifecycle: employees can submit assigned work from In Progress into Done, where it is marked Under review; organization administrators receive a task-update push notification through the existing notification system; approval records the task as completed and leaves it in Done; rejection records the rejected status and returns the task to In Progress. It also covers how the existing reopen flow remains distinct from submission rejection.

The entry documents the compact card design and its high-red, medium-blue, and low-yellow full-card priority fills; the filters and desktop, touch, and keyboard interactions; optimistic persistence and rollback; and task-detail integration. It identifies the frontend hook and components, both API implementations, and the two database migrations for Kanban ordering and rejected status. Finally, it notes that the deployed Edge function and database must be updated before the local UI can persist changes against the shared backend, and records the build and syntax checks performed.
