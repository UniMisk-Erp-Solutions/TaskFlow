# Real-Time Chat (General, Groups, Private Chats, Replies, Attachments)

## Purpose

A built-in chat for both portals (admin and employee), available from the **Chat** item in the sidebar. It replaces ad-hoc messaging outside the product and keeps conversations inside the organization.

## Conversation types

| Type | Who can see it | How it is created |
|---|---|---|
| **General** (`group`) | Everyone in the organization | Created automatically on first use (`chat_ensure_general`) |
| **Group** (`team`) | Only its members | **+** button next to search -> name + members (`chat_create_group`) |
| **Private chat** (`direct`) | Only the two participants | Find a person in search, or type `/name` in any message box (`chat_get_or_create_dm`) |

The creator of a group becomes its **group admin**. Group admins can rename the group, add members and remove members. Any member can leave. If the last admin leaves, another member is promoted.

## Adding members: previous history choice

When a group admin adds people, they choose:

- **Show previous chat history** - new members can read everything sent before they joined.
- **Hide previous chat history** - new members only see messages sent after they joined.

This is enforced in the database (`chat_can_read_message` and the `history_from` column on `chat_participants`), not only in the UI, so hidden messages are never delivered to the new member's browser. A system message ("X added Y (previous messages hidden)") is posted in the group.

## Messaging features

- **Real-time delivery** through Supabase Realtime (`postgres_changes` on `chat_messages`), with a 6 second refresh as a fallback when websockets are blocked.
- **Reply** to a specific message: swipe the message to the right, double-click it, or use the hover reply button. The quoted message is shown in the bubble and clicking it scrolls to the original.
- **Edit** your own text messages (pencil icon, Esc cancels). Edited messages show "(edited)" and update live.
- **Delete** your own messages.
- **Unread counters** per conversation (`chat_unread_counts`), cleared by `chat_mark_read`.
- **Attachments**: files, images, video and voice recordings (up to 50 MB each).
  - Choose files with the paperclip, drag and drop them on the chat, or paste with Ctrl/Cmd+V (screenshots and copied images are named `Screenshot <timestamp>.png`). If the clipboard also contains text, the text is pasted instead.
  - Nothing is sent immediately: files appear in a **preview tray** with a caption box and a remove button, and are sent only when the user presses Send.
  - **Voice messages**: the mic button records, then the recording is staged in the same preview tray. Recording needs HTTPS or localhost.

## Data model (migrations)

- `20261015140000_chat.sql` - conversations, participants, messages, RLS, `chat_ensure_general`, `chat_get_or_create_dm`, `chat_mark_read`, `chat_unread_counts`.
- `20261015160000_chat_attachments_edit.sql` - attachment and `edited_at` columns, the `chat-files` storage bucket and its policies.
- `20261015180000_chat_replies_groups.sql` - `reply_to_id`, system messages (`kind`), `team` conversations, participant roles and `history_from`, group RPCs (`chat_create_group`, `chat_add_members`, `chat_remove_member`, `chat_rename_group`).

All tables are protected by row level security. Reads and realtime events only reach people allowed to see the conversation. Group membership changes go through `SECURITY DEFINER` functions that check the caller is a group admin.

## File storage

Attachments are stored in the private `chat-files` bucket (path `<conversation_id>/<uuid>-<name>`). The TaskFlow Supabase storage backend is S3 (`STORAGE_BACKEND=s3`, the stack's own MinIO), so chat files live in S3. They are opened with short-lived signed URLs; storage policies only allow people who can access the conversation.

## Frontend

`frontend/src/components/ChatPage.jsx` (single component: list, thread, composer, group dialogs).

## Known limits

- File and voice messages can be deleted but not edited.
- Deleting a message does not delete its stored file.
- Voice recording is unavailable on plain `http://<ip>` pages.
