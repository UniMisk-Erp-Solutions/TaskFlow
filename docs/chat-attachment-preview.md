# Chat Attachments: In-App Preview and Download

Date: 19/10/2026.

## Problem
Clicking an image or document in a chat (General, groups, private chats) opened the raw storage link in a new browser tab, showing the long storage address in the address bar.

## Fix
- Images and documents now open in the same in-app viewer used by the Files page (`FilePreviewModal`), with a **Download** button and Esc to close. Previewable types (images, PDF, text, ...) show inline; other files offer a download.
- The file is fetched with the signed-in user's storage permissions (`supabase.storage.from('chat-files').download`), shown from a temporary in-memory blob, so no storage link is opened or shown.
- Each attachment also has its own Download icon (saves the file directly).
- Audio and video keep their inline players. The modal is rendered in a portal so swipe-to-reply transforms do not break its position.
- `FilePreviewModal` gained an optional `source.load()` loader for files that do not come from the API.

## Files
`frontend/src/components/ChatPage.jsx`, `frontend/src/components/FilePreviewModal.jsx`, test `frontend/src/components/__tests__/ChatAttachment.test.jsx` (passing).

## Not verified
Manual check in the browser against production chats. Note: the thumbnail `<img>` still loads from a short-lived signed URL (it is not a link anyone can open from the page). The Flutter app was not changed.
