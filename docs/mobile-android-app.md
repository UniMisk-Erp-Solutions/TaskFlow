# TaskFlow Mobile App (Flutter, Android and iOS)

## Purpose

A native mobile client for the whole TaskFlow system with a new mobile-first design, built with **Flutter** in the `mobile/` folder. It uses the **existing backend unchanged**: the same Supabase project, the `api` Edge Function and the same realtime tables, so accounts, tasks, files and chats are shared with the web app.

## Technology

- Flutter 3.47 / Dart, Material 3 with a light and dark theme (system, light or dark, remembered).
- `supabase_flutter` for sessions, realtime, chat and storage; `dio` for the REST API; `go_router` for navigation; `provider` for state; `file_picker`, `url_launcher`, `share_plus`, `intl`.
- Configuration is injected at build time with `--dart-define-from-file=env.json` (`API_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`). `env.json` is git-ignored; `env.example.json` is committed.

## Screens and features

| Area | What it does |
|---|---|
| Sign in / create account | Email and password; onboarding (phone OTP, create or join organization) and pending-approval screens |
| Tasks tab | Stats, search, status filters, admin review shortcut, tasks and meetings lists, 35 per page, pull to refresh |
| Task detail | Edit (admin), status, submit for review, approve/reject/reopen, timer, attachments, timeline, delete |
| Board tab | Four columns, Individual/Project scope (employee), move menu, timers, review dialog with optional past end time, approved tasks clear after 60 s |
| Timer tab | Week/month/all filters, person filter (admin), Hours/Days units, charts, expandable person cards with status filters, started/ended readings and session history |
| Files tab | Folders, uploads streamed straight to storage, public by default with private option, edit name/access, delete, search, filters, admin properties and CSV export, activity log |
| Calendar and meetings | Month calendar with due dates and meetings; create, edit, approve meetings |
| Projects | Progress, items, admin create/edit/archive/delete, employees see assigned projects |
| Chat | Team chat, direct messages, groups, replies, edit/delete, attachments, realtime |
| AI assistant | Same `/ai/query` endpoint as the web assistant |
| Team (admin) | People list, create, edit, set password, remove, join requests |
| Reminders, Notifications, Profile | Send reminders, preference toggles, profile and appearance |

## Toolchain (installed on the development PC)

Under `C:/Users/Jay/dev`: Flutter SDK, JDK 17 (Temurin), Android SDK (platform 36, build-tools 36.0.0, platform-tools). Build with:

```bash
cd mobile
flutter build apk --release --dart-define-from-file=env.json
```

The APK is written to `mobile/build/app/outputs/flutter-apk/app-release.apk`.

## Status and known gaps

- Whiteboard drawing/collaboration (Excalidraw) is web-only; the app lists the boards.
- Native push notifications need a server channel for mobile tokens; preferences are shared with the web app.
- Google sign-in is not part of the mobile sign-in screen yet.
- The release APK is signed with the debug key; create a release keystore before publishing to the Play Store.
