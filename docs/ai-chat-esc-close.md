# AI Assistant: Close with the Esc Key

Date: 17/10/2026.

- Pressing **Esc** now closes the AI Assistant panel, the same as clicking the X button.
- Implemented in `frontend/src/components/AiChat.jsx` with a `keydown` listener on the document that is added on open and removed on close/unmount. Keypresses already handled by something else (`defaultPrevented`) are ignored.
- Test: `frontend/src/components/__tests__/AiChatEsc.test.jsx` (Esc closes once; other keys do nothing; no listener after unmount). Passing.
- Not verified: manual check in the browser (login was not available to the automated browser).
