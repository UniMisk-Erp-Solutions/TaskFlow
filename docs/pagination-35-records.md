# Pagination (5 Records per Page)

## Purpose

Long lists no longer need endless scrolling: every record list is split into pages of **5 records** (changed from 35 on 2026-10-15; the size lives in one constant, `PAGE_SIZE` in `Pagination.jsx`).

## Where it applies

- Tasks table (`TaskTable.jsx`) and meetings table (`MeetingTable.jsx`).
- Combined Overview/Project table (`OverviewUnified.jsx`). The previous hard `limit` (40 rows) was replaced by paging, so no records are hidden any more.
- Files explorer (`FileExplorer.jsx`), including search results.
- Timer page: the task rows inside each expanded person card (`TimerAnalytics.jsx`).

The Kanban board is not paged because its columns are drag targets.

## Behavior

- `frontend/src/components/Pagination.jsx` exports `usePagination(items, { pageSize = PAGE_SIZE (5), resetKey })` and a `<Pagination>` control.
- The control shows "Showing 1-5 of N", previous/next buttons and a windowed page list (first, last, current and neighbours with ellipses). It is hidden when there are 5 records or fewer.
- Paging resets to page 1 when the sort, filter, folder or search changes, and clamps when the list shrinks (for example after a delete).
- Paging is client-side over the already loaded list; sorting applies to the whole list before it is split.
- Styles: `.pager*` in `frontend/src/index.css`.
