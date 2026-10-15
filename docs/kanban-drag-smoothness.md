# Kanban Drag Smoothness and Text-Selection Fix


## Problem

Dragging a card sometimes highlighted card text as if it were being selected, and movement felt laggy.

## Causes

1. Nothing prevented the browser's native text selection once a drag started.
2. Each animation frame called `getBoundingClientRect()` on the floating preview (forced layout) and ran `document.elementFromPoint` twice.
3. Card/column transitions animated while dragging.

## Changes

- `frontend/src/components/KanbanBoard.jsx`
  - On the first drag movement the code clears the current selection and adds `is-kanban-dragging` to `<body>`; the class is removed on drop, cancel, or unmount cleanup.
  - The preview size is measured once (`runtime.previewSize`) and reused.
  - The preview transform is applied first each frame; a single `elementFromPoint` result is shared by drop-target detection and edge auto-scroll.
- `frontend/src/index.css`
  - `user-select: none` on `.kanban-card` and `.kanban-drag-preview`.
  - `body.is-kanban-dragging` disables selection and forces the grabbing cursor.
  - Transitions disabled on the dragged card and columns during the drag.

## Related

See `kanban-pointer-drop-targets.md` for the underlying pointer drag model.
