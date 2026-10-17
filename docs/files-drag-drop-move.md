# Files: Drag and Drop to Move Items into Folders

Date: 17/10/2026.

## What changed
- In the Files page you can now **drag a file or folder you own and drop it onto a folder** to move it there. Valid drop targets: a folder row, a breadcrumb (including **My files**) and the "Back to ..." row, so items can also be moved out to a parent folder or the root.
- Items you do not own are not draggable. A folder cannot be dropped onto itself.
- Dragging files in from your computer still uploads them as before; internal drags are told apart by the absence of `Files` in the drag data.
- Drop targets get a dashed highlight; the activity log records a new **Moved** action.

## API
`PATCH /drive/files/:id` and `PATCH /drive/folders/:id` accept `{ "folder_id": "<uuid|null>" }` (`null` = My files).
- Only the owner can move an item, and only into one of their own folders (404 otherwise).
- A folder cannot be moved into itself or one of its own subfolders (400).
- A duplicate folder name in the target returns 409. Moving to the current location is a no-op.

## Files
`frontend/src/components/FileExplorer.jsx`, `frontend/src/index.css`, `supabase/functions/api/index.ts`, test `frontend/src/components/__tests__/FileExplorerDrag.test.jsx` (3 tests, passing).

## Verified / not verified
Verified: unit tests (drop moves a file, non-owned files are not draggable, folder onto itself is ignored); Edge Function deployed to the server (backup `index.ts.bak-pre-move-20261017`). Not verified: a manual drag in the browser against production data (login was not available to the automated browser).
