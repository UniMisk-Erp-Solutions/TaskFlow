# Files Preview/Download, 40-Record Pagination, Task Edit Fix and Subtasks

Fixes for the four issues noted on 16/10/2026.

## 1. Files could not be downloaded or previewed

**Cause.** Files were opened with `window.open(signedUrl)` after an asynchronous request, which browsers treat as a pop-up and block, and the signed storage URLs are minted against the internal server address. Meeting attachments used a plain link with no login header.

**Fix.**
- New API route `GET /drive/files/:id/content[?download=1]` streams the file through the API after the same visibility check as before and records the "opened"/"downloaded" audit event. Task and meeting attachments accept `?stream=inline|download` on their existing download route. The Edge Function fetches the object server-side (`streamStoredFile` in `supabase/functions/api/index.ts`) and returns it with `Content-Disposition`, so the browser never needs to reach the storage host.
- Web (`frontend/src/lib/fileAccess.js`): authenticated blob download that triggers a real browser download, plus `previewKind()` to decide what can be shown.
- New in-app viewer `FilePreviewModal.jsx`: images, PDF, video, audio and text/code/CSV/JSON preview inline; other types show a Download button. Used by the Files page (click a file name or the eye icon), task attachments and meeting files.
- Mobile: files and attachments download through the API into the app cache and open with the phone's own viewer; Download uses the share sheet ("Save to device").

## 2. Pagination: 40 records per page

- `PAGE_SIZE = 40` for the shared hook/control (it had been set to 5 for testing). The mobile app uses 40 as well.
- The Users table is now paged too. Changing page scrolls the top of the list back into view.

## 3. Task edit: screen blinked and the editor vanished

**Cause.** `TaskDetailModal` reloaded the task and reset edit mode whenever its parent re-rendered. The parent hands down a new `getTaskHistory` function every render (and re-renders on live refresh and timer updates), so the load effect re-ran every few seconds and dropped the user out of edit mode. `MeetingDetailModal` had the same flaw.

**Fix.** The history callback is kept in a ref so it no longer retriggers the effect; the record is fetched once per task id. Silent refreshes never touch edit mode or typed text.

## 4. Subtasks

- Subtasks section is always visible in the task detail (not only inside edit mode): progress ("2/5 done"), each subtask with its status and due date, click to open it.
- Quick add: type a title and press Enter. Admins pass the parent's team on; employees add subtasks for themselves (allowed when assigned to the parent). "With details…" opens the full task form.
- The detail view and the task lists refresh after a subtask is added. Mobile has the same section and quick add.

## Tests

Frontend: `npm test` (Vitest + Testing Library) covers the edit-mode regression (it fails on the old code), saving an edit, adding a subtask as admin and as an assigned employee, hiding the add box from non-assignees, preview-type detection and the 40-record page size. Mobile: `flutter test` (14 tests) and `flutter analyze` pass.

## Rollout

The `api` Edge Function was redeployed to the TaskFlow Supabase stack (backup `index.ts.bak-pre-filestream-20261016`). No database change is required.
