# Timer Analytics: Filters, Charts, Units, and Person Cards


## Filters

- **Period**: All time, This week (Monday-based), This month. Sessions are clipped to the period start, so only time inside the period counts. Within a period, task lists show only tasks worked on in that period.
- **Person** (admin): Everyone or a single person; employees always see their own data.

## Charts

- **By task**: horizontal bars, top 12 with "Show all".
- **Over time**: columns per day (week/month) or per week (all time). In Hours mode it becomes time by hour of day (12a to 11p).
- **By person** (admin, Everyone selected).

## Unit toggle (Days / Hours)

A page-wide unit. All values are whole numbers:

| Duration | Hours | Days |
|---|---|---|
| 9h 21m | `9h 21m` | `9h 21m` |
| 25h | `25h` | `1d 1h` |
| 193h 53m | `193h 53m` | `8d 1h` |

A day is 24 hours; zero parts are omitted.

## Person cards

Cards show task counts per status, total tracked time, and average per completed task. Expanding a card shows the task rows ordered In progress, To do, Under review/Rejected, Completed. To do and Backlog rows have no tracked time. Filter chips (All, In progress, To do, Under review, Completed) with counts are available per card, and "Expand all / Collapse all" controls the whole list.

## Files

`frontend/src/components/TimerAnalytics.jsx`, styles in `frontend/src/index.css` (`timer-*` classes). Data comes from `useTaskTimers` (`/tasks/timer-analytics`).
