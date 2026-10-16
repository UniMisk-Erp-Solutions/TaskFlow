# TaskFlow Mobile (Flutter)

Flutter app for TaskFlow on Android and iOS. It uses the same backend as the web app.

## Setup

1. Install Flutter (3.47+) and the Android SDK.
2. `cp env.example.json env.json` and fill in `API_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
3. `flutter pub get`

## Run

```bash
flutter run --dart-define-from-file=env.json
```

## Build an APK

```bash
flutter build apk --release --dart-define-from-file=env.json
```

Output: `build/app/outputs/flutter-apk/app-release.apk` (install it on a phone with USB debugging, or share the file).

## Structure

- `lib/core` API client, models, formatting, kanban and timer logic
- `lib/state` auth and shared data controllers (with realtime and background refresh)
- `lib/ui` theme and widget kit
- `lib/screens` one file per feature area
