# Draggable AI Assistant Button


- Component: `frontend/src/components/AiFab.jsx`, used by both dashboards.
- Default position: 28px from the bottom-right corner.
- Drag to move (5px threshold distinguishes a click, which opens the assistant). The position is clamped to the viewport and re-clamped on resize.
- Persistence: `localStorage` key `taskflow:ai-fab-position:<user id>`, so each signed-in user keeps their own position in that browser. It is not synced across devices.
- Keyboard: focus the button and press Alt + arrow keys (Shift for larger steps).
- Layout: `main { padding-bottom: 96px }` in `index.css` keeps the final content rows clear of the button; the button is slightly translucent until hovered.
