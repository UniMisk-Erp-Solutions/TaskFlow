# AI assistant upgrade: OCR, memory, image task creation, safe assignees

Date: 17/10/2026. Code: `supabase/functions/api/index.ts` (`runAiAssistant`, the `// AI-CORE` block, `handleAiRoutes`), `frontend/src/components/AiChat.jsx`, migration `supabase/migrations/20261017120000_ai_assistant_memory.sql`.

The existing design is kept: the model only emits a small JSON op, and every create/update/delete runs through the same handlers the dashboard uses (`aiDispatch`, as the same user), so permissions are unchanged. The WhatsApp "TaskFlow-AI" mode shares `runAiAssistant` and gets the same features (separate conversation, `channel = 'wa'`; no image input there).

## What was added
| Feature | How it works |
|---|---|
| OCR | Frontend attaches up to 3 images (file picker or paste), downsizes them, and sends `images: [dataURL]` to `POST /ai/query`. The Edge Function asks a vision-capable OpenRouter model to transcribe the text and list the tasks as JSON. Image text is treated as data, never as instructions. |
| Context memory | `ai_conversations` stores the last 16 messages per user and channel (expires after 12 h idle). They are sent to the model as plain text, so follow-ups like "make it high priority" or "assign it to him" work. The panel restores them via `GET /ai/state`; **New chat** calls `POST /ai/reset`. |
| Long-term memory | `ai_memories` holds short notes. The model saves one only when the user explicitly asks or states a standing preference, in a typed message (never from images). Notes containing password/OTP/key/card/ID words are rejected. Max 40 per user. Users see and delete them in the panel (**Memory**) or by saying "forget …". |
| Tasks from images | Extracted tasks are shown as a numbered list, then handled one at a time. The assistant asks for a registered assignee and, when the photo has no clear due date, a due date. It creates each task through the normal task API as soon as that information is complete, then proceeds to the next task. No final batch confirmation is required. Max 15 tasks per image batch. |
| Smart assignee | See below. |
| Natural language | Same ops as before, plus multi-task create (`tasks: [...]`), draft edit/confirm/cancel, and `forget`. Ambiguous task titles are listed back instead of failing. |
| Confirmation | After each create the reply is built from the API response: the task id must exist and the returned `assignee_ids` must contain the intended assignee, otherwise the reply says the assignee could not be confirmed. Failed items stay pending for a retry (*confirm*). |

## Assignee rule: never guess
A name is used only if all of these hold:
1. The user typed it (this message or an earlier **user** message in the chat), or it appears in the attached image text, or it is in a saved memory note. Names that only the assistant mentioned do not count. "me" counts only if the user wrote me/my/I.
2. It maps to exactly one registered member of the user's organisation: exact name or email, or whole-word name tokens ("Ravi" matches "Ravi Kumar" only if there is no other Ravi). No fuzzy or partial matching, so an OCR typo like "Rav1" is "not registered".

Otherwise the assistant asks: missing -> "Who should I assign X to?"; ambiguous -> lists the candidates; not registered -> says so and lists teammates. Typed single-task requests with a valid assignee run immediately as before; image drafts always wait for *confirm*. When an assignee comes from a saved note, the reply says "(saved preference)".

## Setup
1. Apply the migration (`supabase/migrations/20261017120000_ai_assistant_memory.sql`). Without it the assistant still works but has no memory (storage errors are swallowed on purpose).
2. Redeploy the `api` Edge Function and the frontend.
3. OCR uses `OPENROUTER_VISION_MODEL` (env) or `app_settings` key `openrouter_vision_model` when configured; otherwise it falls back to OpenRouter's image-capable `google/gemini-2.5-flash`. The existing `OPENROUTER_API_KEY` / `openrouter_api_key` is reused.

## Tests
`node supabase/tests/test-ai-core.mjs` runs 26 checks on the pure logic (assignee resolution and grounding, drafts, edits, memory filter, history trimming). It extracts the code between the `AI-CORE` markers, so keep that block free of Deno APIs.

## Not verified / known limits
- The Edge Function orchestration (DB reads/writes, OpenRouter requests, vision call) must be exercised against a local Supabase stack with local function secrets and a configured vision model. Do not use a hosted frontend API URL for task-creation tests.
- OCR accuracy on handwriting depends entirely on the vision model chosen.
- Free models give inconsistent JSON; the existing salvage/rephrase path still applies.
- `delete_task` / `delete_meeting` / `delete_user` still run immediately as before (no confirmation step added).
- Two simultaneous requests from one user could both execute the same draft (the draft is claimed before creating, which narrows but does not remove the race).
- The Express `backend/src/controllers/aiController.js` is the old path and was left untouched. The mobile app still sends text only, which keeps working.

## OCR without a vision model (17/10/2026)
The existing models are text-only (Qwen3-0.6B for the local fallback, a text model on OpenRouter), so photos are read **in the browser** with Tesseract (`tesseract.js`, assets self-hosted in `frontend/public/ocr/`, no key, no external requests). The chat sends only the recognised text (`ocr_text`, `ocr_confidence`) to `POST /ai/query`; the Edge Function turns it into tasks with a deterministic parser (`aiTasksFromText`) and then runs the one-task-at-a-time assignee/due-date flow.
- Works well on screenshots and printed or typed lists. Handwriting is not supported: below 45% confidence the assistant refuses and asks for typed text (the sample handwritten notebook page scored 32%); 45-65% shows a "hard to read" warning.
- Photos OCR cannot start on, and PDFs, are still sent as files and need a vision model (`OPENROUTER_VISION_MODEL`); without one the user gets a clear message.
- The parser does not call a model, so wrapped lines, "→ Owner", "- Owner", "due 25 Nov" and "→ Done" are handled by rules; anything unclear stays empty and is asked.
- Tests: `node supabase/tests/test-ai-core.mjs` (32 checks). The end-to-end run (55/56 checks incl. OCR text flow, memory, assignee rules) used a throwaway server stack that is not part of the repo.
