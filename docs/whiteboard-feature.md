# Live Whiteboard (Infinite Canvas, Multiple Screens)

## Purpose

A shared, always-live whiteboard for the whole organization, available from the **Whiteboard** sidebar item in both portals. Everyone draws on the same canvas and sees each other's changes and cursors in real time.

## What users get

- Infinite canvas with zoom (+/- controls, Ctrl+wheel, pinch), pan (drag, Space, hand tool).
- Shapes, pen, arrows, text, eraser, undo/redo and **image upload**.
- Named live cursors and an "N online" counter.
- **Screens**: a **New screen** button adds another blank live board (Screen 2, 3, ...). Tabs switch between **Main** and the other screens; everyone sees the same list live. A screen can be deleted by the person who created it; Main cannot be deleted.
- "All changes saved" indicator.

## How it works

- The canvas is **Excalidraw** (`@excalidraw/excalidraw`, MIT licensed, runs entirely in the browser; no external API or key). Its fonts are loaded from a public CDN by default.
- **Live sync** uses a Supabase Realtime broadcast channel per board (`whiteboard:<board id>`): changed elements are batched (60 ms) and merged on receipt with Excalidraw's `reconcileElements`. Cursors are broadcast every 50 ms and presence provides the online count.
- **Persistence**: the scene (elements) is saved to the `whiteboards.scene` JSON column, debounced to 1.2 seconds, and on leaving the page.
- **Images** are uploaded to the private `whiteboard-files` bucket (path `<board_id>/<file_id>`), which is backed by the stack's S3/MinIO storage. Other viewers download missing images by file id, detect their type from the bytes (storage can return a generic content type), and retry for a few seconds if the upload is still in flight.

## Data model (migrations)

- `20261015220000_whiteboards.sql` - `whiteboards`, `whiteboard_members`, access functions (`wb_can_access`, `wb_is_owner`), RLS, owner-only rename/visibility guard trigger, `whiteboard-files` bucket and policies.
- `20261015230000_whiteboard_main.sql` - `is_main` flag and `wb_ensure_main()` (one shared board per organization, created on first open).
- `20261015240000_whiteboard_screens.sql` - `wb_create_screen()` (extra screens).

The schema still supports private boards with invited members (`visibility`, `whiteboard_members`), but the current UI only exposes the shared board and its screens.

## Frontend

`frontend/src/components/WhiteboardPage.jsx`, loaded lazily so Excalidraw does not affect the initial bundle.

## Known limits

- Everyone in the organization can edit (no view-only mode).
- Two people editing the same shape at the same instant resolve last-edit-wins.
- The broadcast channel is keyed by the board's random id; database access itself is protected by RLS.
