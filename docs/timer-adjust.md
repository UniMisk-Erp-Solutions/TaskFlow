# Timer: Adjust a Forgotten Timer

Date: 28/10/2026.

## Problem
People sometimes forget to pause or stop a task timer, so the tracked time was wrong with no way to correct it.

## What was added
- **Adjust button** on the Kanban card of a task in progress (shown once you have at least one timer session on it, whether the timer is running or paused). It opens an **Adjust timer** dialog where you set the time you actually finished, with quick buttons (-15 min, -30 min, -1 h, Now), an optional reason and a live preview of the new session length.
- **Rules (checked in the dialog and on the server):** the end time cannot be before the timer started, cannot be in the future, and cannot overlap your next session. You can only adjust your own sessions. Adjusting a still-running timer stops it at that time.
- **Admin visibility:** every adjusted session keeps `adjusted_at`, `adjusted_by`, `original_ended_at` (what it was before; empty means it was still running) and `adjust_reason`. Admins see an **Adjusted** tag, with the details in its tooltip, on the Kanban card and on the person/task rows of the Timer page. All totals (cards, Timer page charts, admin Kanban totals) use the adjusted end time, so they update everywhere.

## Technical changes
- Migration `supabase/migrations/20261019100000_timer_adjustments.sql` (applied to the TaskFlow database with the `supabase_admin` role because `postgres` does not own the table).
- Edge API: `POST /tasks/:id/timer/adjust` with `{ session_id?, ended_at, reason? }`; `GET /tasks/timer-analytics` now also returns the adjustment fields. Edge Function redeployed (backup `index.ts.bak-pre-adjust-20261028`).
- Web: `TimerAdjustModal.jsx`, `useTaskTimers.adjust`, `KanbanBoard.jsx`, `TimerAnalytics.jsx`, `index.css`. Test: `__tests__/TimerAdjustModal.test.jsx` (2 tests passing); production build passes.

## Not done / not verified
- The adjust endpoint and the dialog were not exercised against production with a real login (no credentials available to the automated browser).
- The Flutter app and the local Express backend do not have the Adjust option yet.
- There is no "undo adjustment" button; the original end time is stored for admins only.
