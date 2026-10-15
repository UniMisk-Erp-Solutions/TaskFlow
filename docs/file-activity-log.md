# File Activity Log (Audit Trail) with Visibility-Aware Access

## Purpose

A detailed history of everything that happens to files and folders: who did it, what, when (to the second) and the details (old and new names, old and new access, size, and so on) while never exposing private activity to administrators.

## What is recorded

| Action | Details stored |
|---|---|
| Uploaded | size, content type, access, folder |
| Folder created | access, parent |
| Renamed | old name and new name |
| Access changed | Public to Private or Private to Public |
| Opened / Downloaded | actor and time |
| Deleted | size, or number of files removed with a folder |

Each event keeps a snapshot of the item name and the actor name, so history stays readable after renames or deletions.

## Who can see what

- **Owner:** every event of their own files and folders, public or private.
- **Administrator:** only events that were **public when they happened** for items that are **public now** (or were public when deleted), plus their own items. Events from a private period are never shown, even if the item is made public later, and private items are never shown at all.
- **Everyone else:** only their own items. Employees never see other people's activity.

This is enforced on the server (`GET /drive/activity` in the Edge Function). Every event stores `public_at_event`; the API combines it with the item's current visibility. Row-level security additionally restricts direct database reads to the owner.

## Storage

`drive_activity` table (`supabase/migrations/20261015260000_drive_activity.sql`): org, actor, item kind/id/name, item owner, action, details jsonb, `public_at_event`, timestamp. Writes use the service role.

## Interface

- **Activity log** tab in the Files page: time, who, action, item, details; filter by action, search, pagination (35 per page).
- **History** icon on each item (owner or admin) opens the log focused on that one item.
- Admin **Properties** and **Export details** features are described in `file-explorer-multi-tenant-storage.md`.

## Rollout

Migration applied to the TaskFlow production database; Edge Function deployed with backup `index.ts.bak-pre-driveaudit-20261015`. Events are recorded from deployment time onward; earlier history does not exist.
