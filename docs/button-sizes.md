# Bigger Buttons

Date: 28/10/2026.

All web buttons were made larger for easier clicking and tapping (`frontend/src/index.css`):
- `.btn` (default): padding 11x22 -> 13x26, font 17 -> 18 px.
- `.btn-sm`: padding 8x16 -> 11x20, font 14 -> 15 px.
- Header action buttons (New Task, New Meeting, Import, Reminders and similar): height 34 -> 42 px (desktop), 34 -> 40 px (mobile), larger text.
- Kanban card buttons (Start / Pause / Adjust): padding 4x9 -> 7x13, font 11 -> 13 px; mobile Kanban action buttons 36 -> 42 px high.

To change the size again, edit those values in `index.css`. Not checked visually on every page; the 97 unit tests pass.
