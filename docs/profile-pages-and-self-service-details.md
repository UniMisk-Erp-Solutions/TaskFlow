# Profile Pages and Self-Service Account Details

## Purpose

TaskFlow now gives administrators and employees a dedicated Profile page instead of limiting account identity to the compact sidebar footer. The page presents the signed-in account's identity and workspace context and allows each person to update their own display name and phone number.

## User experience

- Both role-specific sidebars include a Profile destination, and the existing name/avatar area is also a shortcut to that page.
- The route is role-scoped by the existing dashboard routers: `/admin/profile` for administrators and `/dashboard/profile` for employees.
- The page shows the account name, email, role, workspace, join date, and account status. It includes a responsive identity summary and a personal-information form.
- Full name and phone are editable. Email, role, organization membership, and account status remain read-only. The email helper text directs a user to their workspace administrator for changes.
- A successful save refreshes the shared authenticated profile so the sidebar and dashboard greeting update immediately. Errors are shown inline.

## API and security

The frontend sends `PATCH /auth/me` with `fullName` and `phone`. The Express API and the Supabase Edge API both validate these fields and update only the authenticated user's `profiles` row, selected by the verified user ID. They do not accept a user ID, role, status, or organization from the request body, preventing users from changing another account or elevating their permissions. The current user's GET `/auth/me` response also exposes workspace display information for the profile card.

The local backend route is implemented in `backend/src/routes/auth.js` and `backend/src/controllers/authController.js`. The hosted route is implemented in `supabase/functions/api/index.ts`, which is the API used when the frontend's `VITE_API_URL` points to the deployed Edge Function. Deploy that Edge Function for profile editing to work in the hosted environment; the frontend itself requires no database migration because it uses the existing profile name, phone, role, organization, status, and creation fields.

## Main code locations

- `frontend/src/components/ProfilePage.jsx` — profile summary, editable fields, save feedback, and responsive layout.
- `frontend/src/components/Sidebar.jsx` — Profile navigation and sidebar identity shortcut for both roles.
- `frontend/src/AdminDashboard.jsx` and `frontend/src/EmployeeDashboard.jsx` — role-specific route acceptance and page rendering.
- `backend/src/controllers/authController.js` and `backend/src/routes/auth.js` — authenticated Express read/update behavior.
- `supabase/functions/api/index.ts` — matching hosted API behavior.

## Operational notes

No SQL migration is required. Existing accounts with no phone number display an empty phone field, and missing workspace/date values use a neutral fallback. API credentials remain in the established authenticated request flow; no profile write is performed directly from the browser to Supabase.
