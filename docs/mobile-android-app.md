# TaskFlow Mobile App (Android and iOS)

## Purpose

A native-feeling mobile client for the whole TaskFlow system with a new mobile-first design. It lives in the new `mobile/` folder and uses the **existing backend unchanged**: the same Supabase project, the `api` Edge Function and the same realtime tables. Accounts, tasks, files and chats are shared with the web app.

## Technology

- Expo (React Native) with TypeScript and expo-router (file-based navigation).
- `@supabase/supabase-js` with the session stored in the device's secure storage (chunked SecureStore adapter), `axios` for the REST API.
- Light and dark themes (system, light or dark, remembered).

## Screens and features

| Area | What it does |
|---|---|
| Sign in / create account | Email and password, role-aware; onboarding (phone OTP, create or join organization) and pending-approval screens |
| Tasks tab | Stats, search, status filters, admin review queue shortcut, tasks and meetings lists, 35 per page, pull to refresh |
| Task detail | Edit (admin), status, submit for review, approve/reject/reopen, timer, attachments (upload and open), timeline, delete |
| Board tab | Four columns, Individual/Project scope (employee), move via menu, timers, review dialog with optional past end time, approved tasks clear after 60 s |
| Timer tab | Week/month/all filters, person filter (admin), Hours/Days units, charts, expandable person cards with status filters, started/ended readings and session history |
| Files tab | Folders, upload (streamed straight to storage), public by default with private option, edit name/access, delete, search, filters, admin properties and CSV export, activity log |
| Meetings and Calendar | Month calendar with due dates and meetings, create/edit/approve meetings |
| Projects | Progress, items, admin create/edit/archive/delete, employees see assigned projects |
| Chat | Team chat, direct messages, groups, replies, edit/delete, attachments, realtime |
| AI assistant | Same `/ai/query` endpoint as the web assistant |
| Team (admin) | People list, create, edit, set password, remove, join requests |
| Reminders, Notifications, Profile | Send reminders, preference toggles, profile and appearance |

## Configuration

`mobile/.env` (copy from `.env.example`): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `.env` is git-ignored.

## Running and building

- Development: `npx expo start`, then scan the QR code with Expo Go.
- APK: `eas build --platform android --profile preview` (see `mobile/README.md` and `mobile/eas.json`).
- No local Android SDK is required for development.

## Status and known gaps

- The project type-checks and the Android JavaScript bundle compiles; it has not yet been run on a physical device or emulator in this environment.
- Whiteboard drawing/collaboration (Excalidraw) is web-only; the app lists the boards.
- Native push notifications need a server-side channel for mobile tokens; currently preferences are shared with the web app.
- Google sign-in is not part of the mobile sign-in screen yet.
