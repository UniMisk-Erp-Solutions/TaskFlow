# Production Data Reset (2026-10-16)

Before going live, all test data was removed from TaskFlow's self-hosted Supabase (only the TaskFlow stack on the Coolify host was touched).

## Kept
- Users: `auth.users` (10) and `profiles` (10: 3 admins, 7 employees).
- `organizations` (2), so users keep their organization and join codes.
- `notification_preferences` and `app_settings`.

## Removed
- Tasks, meetings, projects, their assignees, attachments and history, timer sessions.
- Chat conversations, participants and messages; whiteboards and members.
- Files explorer data (folders, files, activity).
- Email, WhatsApp, import and reminder logs, push subscriptions, join requests, one-time phone codes.
- All stored files (8 objects in `chat-files`, `taskflow-files`, `whiteboard-files`) were deleted through the Storage API so the S3 blobs are gone too.

The General chat and the Main whiteboard are re-created automatically on first use.

## How it was done
1. Full backups first, on the server in `~/taskflow-backups/`: a gzip SQL dump of the `public`, `auth` and `storage` schemas, and a copy of the S3 files.
2. Storage objects deleted via the Storage API.
3. One transaction truncated every `public` table except the kept ones, with checks that profiles, auth users and organizations were unchanged (the transaction aborts otherwise).

## Rollback
Restore the SQL backup into the database and copy the backed-up files back into the storage volume. Delete the backups once they are no longer needed because they contain the old data and password hashes.
