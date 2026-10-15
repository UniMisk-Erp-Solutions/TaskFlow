# Collapsible Sidebar


- Toggle button in the sidebar header collapses the 220px sidebar to a 68px icon rail and back (width animates over 200 ms).
- Collapsed items show native tooltips with the page name; labels, brand and user text are hidden.
- `Ctrl/Cmd + B` toggles it unless focus is in an input, textarea, select or editable element.
- The choice is stored in `localStorage` under `taskflow:sidebar-collapsed`.
- Below 760px the sidebar is always icon-only (existing media query) and the toggle is hidden.

Files: `frontend/src/components/Sidebar.jsx`, `frontend/src/index.css` (`.taskflow-sidebar.is-collapsed`).
