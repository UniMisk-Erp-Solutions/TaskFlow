# Production Server Migration, Kanban Deploy, WhatsApp & AI Fixes (2026-10-13)

## Summary

The Kanban board's review workflow (migrations + edge function) was deployed correctly, but task moves still failed in production with a generic `Not found` error. The actual cause was that production had moved to a different server than the one being deployed to, and nobody had confirmed that handoff end-to-end. Once found, the full set of pending fixes — Kanban, the WhatsApp bot, and the AI assistant — was deployed to the correct backend.

## What was actually wrong

The live frontend's configured API base URL does not point at the backend that had been receiving deploys. Diffing the compiled production bundle against what was actually being tested showed a different hostname entirely. All deploys made against the old backend were real and correct, but invisible to users, because traffic had already moved elsewhere.

This explains two separate symptoms that looked unrelated at first:

1. **Kanban board moves returned `Not found`.** The route existed and worked correctly on the backend being tested, but the live frontend was never talking to that backend.
2. **The WhatsApp bot (`/taskflow`) stopped replying, and the AI assistant appeared broken.** The bot's webhook — which the WhatsApp gateway calls on every inbound message — was still registered against the old backend's URL. Even with a healthy WhatsApp connection, inbound messages had nowhere correct to land.

## What was fixed

- **Identified the correct production backend** and confirmed it holds the same data users see (verified against a live task count and specific task IDs visible in the product).
- **Re-deployed the Kanban board + review workflow** (both database migrations and the updated API function) to the correct backend. Verified live with a real authenticated board-move request — previously `404`, now `200`.
- **Corrected the WhatsApp bot's webhook registration** to point at the correct backend's URL, replacing the stale one left over from before the migration.
- **Reconnected the WhatsApp session** (a one-time QR re-link, required because the session had been sitting idle on the correct backend since its own separate disconnect).
- **Switched the AI assistant's model** to `apodex/apodex-1.1-mini:free`, keeping the existing OpenRouter API key configuration. Verified with a live query returning accurate, current task data in under 4 seconds.

## Verification performed

- Authenticated `PATCH /tasks/:id/board` against a real task on the correct backend: `200 OK` (was `404` before the fix).
- Authenticated `POST /ai/query` on the correct backend with the new model: `200 OK`, correct real-data answer, ~3.5s response time.
- WhatsApp gateway webhook confirmed re-registered against the correct backend's `/whatsapp/webhook` endpoint.

## Why this class of issue is worth watching for

A backend migration is invisible from the application's own logs and dashboards if nothing double-checks that every dependent config — the frontend's API URL, the WhatsApp gateway's webhook registration, any other service-to-service URL — was updated at the same time. The safest check after any backend move: pull the *actual* compiled frontend bundle (or inspect the live network request) to confirm which backend it's really calling, rather than assuming it matches whichever backend is currently being worked on.

## Files touched this session

- `supabase/migrations/20261012120000_task_kanban_board.sql`, `supabase/migrations/20261012130000_task_review_rejected_status.sql` — applied to the correct production database.
- `supabase/functions/api/index.ts` — redeployed (Kanban board-move route, WhatsApp reliability fixes, AI assistant) to the correct production backend.
- WhatsApp gateway webhook configuration and AI model configuration — corrected directly in the correct backend's settings (not a code change; no file in this repository holds these values).
