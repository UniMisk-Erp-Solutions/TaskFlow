# File Explorer (Files) with Multi-Tenant Storage and Private/Public Visibility
## Purpose

A shared file explorer for every user (admin and employee) with folder navigation, uploads, search, rename, delete and a per-item **Private / Public** switch.

- **Private**: only the owner can see or open the item (not even admins).
- **Public**: everyone in the same organization can see and open it.

## Multi-tenancy and storage layout

- Dedicated private bucket **`taskflow-files`** (not shared with `task-assets` / `meeting-assets` / chat), no per-file limit set by the app (the storage service's global upload limit still applies, currently 500 MB).
- Object key: `taskflow-files/<org_id>/<owner_user_id>/<file_id>-<safe name>`, so each organization and each person has its own prefix.
- Objects are never public. They are opened through 5-minute signed URLs issued by the API after the visibility check.
- Supabase Storage maps logical buckets onto the configured S3-compatible backend. `taskflow-files` is a separate logical bucket (separate policies, limits and prefix) inside that backend; a physically separate S3 bucket would require a second storage backend, which Supabase Storage does not support per bucket.

## Database

`supabase/migrations/20261015200000_file_explorer.sql`:

- `drive_folders (id, org_id, parent_id, owner_id, name, visibility, ...)` with a unique name per owner per parent.
- `drive_files (id, org_id, folder_id, owner_id, name, bucket, path, content_type, size_bytes, visibility, ...)`.
- RLS: a user can select only their own rows or public rows of their own organization. Writes go through the Edge API with the service role.

## Visibility rules

- A folder is openable by its owner, or by anyone in the organization when it is public **and every ancestor is visible to them**. Making a folder private hides its whole contents from others.
- A file is visible to its owner, or to the organization when it is public and its folder is visible.
- Only the owner can rename or change visibility. The owner can delete; an admin may delete **public** items for moderation but never sees private ones.
- A folder that contains items owned by other people cannot be deleted until those are removed.

## API (Edge Function `supabase/functions/api/index.ts`, `handleDrive`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/drive?folder_id=` | Folder contents, breadcrumbs, owner names |
| GET | `/drive/search?q=` | Search visible files and folders |
| POST | `/drive/folders` | Create a folder |
| POST | `/drive/files` | Upload one or many files (multipart: `file`, `folder_id`, `visibility`) |
| GET | `/drive/files/:id/url[?download=1]` | Signed URL |
| PATCH | `/drive/files/:id`, `/drive/folders/:id` | Rename / change visibility (owner) |
| DELETE | `/drive/files/:id`, `/drive/folders/:id` | Delete (folders remove their tree and objects) |

## Frontend

- `frontend/src/components/FileExplorer.jsx`, styles `.fx-*` in `index.css`.
- Sidebar entry "Files" in both portals; pages `/admin/files` and `/dashboard/files`.
- Breadcrumb navigation, back-to-parent row, drag-and-drop upload, a default-visibility switch for new items, filters (All / Mine / Shared with me), debounced search, inline rename, click-to-toggle visibility badges, silent background refresh.

## Rollout state

- Migration applied to the TaskFlow production database (bucket, tables, RLS verified).
- The updated `api` Edge Function must be deployed for the Files page to work on the hosted API.
- The Express backend (`backend/`) does not implement `/drive` yet; the feature targets the Supabase Edge API used by the hosted app.
- Not included in this version: moving items between folders and sharing with specific people.

## Update: public by default and the Edit dialog

- New files and folders are **Public by default**: the client default, the API fallback (`driveVisibility(..., "public")`) and the column defaults (`20261015210000_drive_default_public.sql`) all agree. Switch the Private/Public control next to Upload to create private items.
- The pencil button opens an **Edit** dialog with the name and a Public / Private choice, so visibility can be changed together with a rename. The badge in the Access column still toggles visibility in one click.
- Deployed to the TaskFlow stack with backup `index.ts.bak-pre-drive-default-20261015`.

## Update: no app-level upload limit (direct-to-storage uploads)

- The 50 MB checks were removed from the UI, the API and the bucket (`20261015220000_drive_no_size_limit.sql` sets `file_size_limit = NULL`).
- Uploads no longer pass through the Edge Function's memory. The browser calls `POST /drive/files/prepare` (creates a signed upload URL under `<org>/<user>/`), uploads straight to storage with `uploadToSignedUrl`, then calls `POST /drive/files/complete` which verifies the object exists, reads its real size, and inserts the `drive_files` row. The path is rebuilt from the caller's own org and user ids.
- The remaining ceiling is the storage service's global `UPLOAD_FILE_SIZE_LIMIT` (500 MB on the TaskFlow server). Raising it means changing that service's environment in Coolify.
- The legacy multipart `POST /drive/files` still exists for small files but no longer enforces a size.
- Deployed with backup `index.ts.bak-pre-nolimit-20261015`.

## Update: admin-only file properties and export

- Administrators get an **Info (Properties)** button on each item and an **Export details** button that downloads a CSV for the items currently listed. Employees never receive this data: the API only attaches the `details` object when the caller is an admin, and the UI hides the controls for everyone else.
- Properties dialog (Windows-style): type, exact size (human and bytes), location, owner and e-mail, access (public/private), **Created**, **Modified**, **Accessed** (with seconds, plus who opened it), times opened, storage path and file id.
- Access tracking: `drive_files.last_accessed_at`, `last_accessed_by`, `access_count` (migration `20261015250000_drive_access_tracking.sql`) are updated whenever a file's signed URL is issued (open or download).
- Privacy is unchanged: private items of other people are not listed to admins, so their properties are not available either.
- Deployed with backup `index.ts.bak-pre-filedetails-20261015`.

