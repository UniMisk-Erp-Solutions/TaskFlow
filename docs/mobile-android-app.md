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
| Tasks tab | Stats, search, status filters, admin review shortcut, tasks and meetings lists, 40 per page, pull to refresh |
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

## Performance and polish

- **No screen-wide ticking.** Running timers and the 60-second "Clears in" countdown live in tiny widgets (`LiveSeconds`, `Countdown` in `lib/ui/live.dart`), so a running timer never rebuilds a whole list.
- **Quiet refresh.** The shared data controller refreshes every 15 s and on realtime events, but skips the rebuild entirely when the server data did not change.
- **Instant controls.** Timer start/pause and status changes update optimistically, then reconcile with the server (and roll back on error).
- **Loading states.** Skeleton placeholders replace spinners; cards are isolated with `RepaintBoundary`; lists are paged at 40 records.
- **Haptics** on tab switches and timer buttons; board column tabs are equal-width so all four columns are always visible.
- **Safe start-up.** A splash route holds the app while the session and profile load, with a retry if the profile cannot be fetched.

## Testing

`flutter test` runs 14 tests: formatting, kanban rules, approval countdown, timer analytics (pauses, resumes, period clipping, hour buckets) and widget tests that render Tasks, Board, Timer, Calendar, More, Task detail, the task form and Login at phone sizes and fail on any layout overflow or exception. `flutter analyze` is clean apart from three style notes.

## Release build and signing

- Launcher icon and adaptive icon are generated from `assets/icon/` with `flutter_launcher_icons`.
- Release builds are signed with `android/app/taskflow-release.jks` using `android/key.properties` (both git-ignored). **Back these two files up**: without them an installed app can never be updated in place.
- `flutter build apk --release --split-per-abi --dart-define-from-file=env.json` produces one APK per CPU type (arm64-v8a is the one for almost every current phone).

## Status and known gaps

- Whiteboard drawing/collaboration (Excalidraw) is web-only; the app lists the boards.
- Native push notifications need a server channel for mobile tokens; preferences are shared with the web app.
- Google sign-in is not part of the mobile sign-in screen yet.
- Google sign-in needs the mobile redirect (`taskflow://login-callback`) added to the Supabase auth allow-list on the server before it can be enabled.
- The app has been verified by analyzer, unit tests and widget tests on this PC; it has not been run on a physical device here.
