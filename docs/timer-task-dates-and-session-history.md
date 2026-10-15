# Timer Task Dates and Session History


## Columns

- **Started**: first session start for that person and task, with `timer 0:00`.
- **Ended**: for submitted/completed tasks, `tasks.work_ended_at` (or the last session end if absent) and the cumulative timer at that point. Running tasks show "Running"; unfinished tasks show "Ongoing".
- **Time worked**: `h:mm:ss` with the unit-toggle value (for example `2.6 h` style or `2h 36m`) shown beneath.

## Session history

A chevron on the task title lists every session: Started with the timer reading at start, then Paused (or Ended) with the reading at that time. Example: start at 0:00, pause at 10:00, resume at 10:00, end at 30:00.

Dates and readings are always computed from all sessions, so the week/month filter does not change a task's real start or end. Time worked does follow the filter; the Ended timer is the full cumulative total.

## Files

`frontend/src/components/TimerAnalytics.jsx`, `frontend/src/index.css`.
