# Google Calendar sync

TaskFlow ships a production-style Google Calendar integration — the same flow
your users see on Calendly, Notion, Linear, and Slack. There are **two
different setups**:

| Audience | Effort | What they do |
|---|---|---|
| **You (SaaS owner)** | ~10 minutes, **once** | Create one Google Cloud OAuth client. Drop the client ID into `frontend/.env`. |
| **Every TaskFlow user, forever** | ~3 clicks each | Open **Settings → Integrations** (or the **Calendar** page), click **"Sign in with Google"**, pick the Gmail to connect, click **Continue**. Done. |

After step A is done once, end users never see Google Cloud Console, an API
key, a secret, or a copy-paste. They get a native "Sign in with Google"
button and a popup — that's the whole experience.

---

## A · One-time SaaS owner setup (you do this once)

### A1. Create a Google Cloud project

1. Open <https://console.cloud.google.com/>.
2. Top-left project picker → **New project** → name it (e.g. `TaskFlow`) →
   **Create**.

### A2. Enable the Google Calendar API

1. **APIs & Services → Library**.
2. Search **"Google Calendar API"** → click it → **Enable**.

### A3. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. **User type:**
   - *External* — anyone with a Google account can connect.
   - *Internal* — only users in your Google Workspace org.
   Pick *External* if you have non-Workspace users.
3. Fill in app name, support email, developer contact.
4. **Scopes** → **Add or remove scopes** → enable
   `https://www.googleapis.com/auth/calendar.events` (no other scopes
   needed).
5. **Test users** — while the app is in *Testing* mode, every Gmail that
   will sign in must be listed here. Once you click **"Publish app"**, any
   Google account can connect without being listed.
6. Save.

### A4. Create the Web-app OAuth Client

1. **APIs & Services → Credentials → + Create credentials → OAuth client ID**.
2. **Application type:** *Web application*.
3. **Name:** anything (e.g. `TaskFlow web`).
4. **Authorized JavaScript origins** — list **every URL your TaskFlow
   frontend is served from** (no trailing slash):
   - `http://localhost:5173` (Vite dev)
   - `http://192.168.16.112:5173` (LAN testing, replace with your IP)
   - `https://app.your-domain.com` (production)
5. **Authorized redirect URIs:** leave empty. TaskFlow uses Google Identity
   Services' token client flow — no redirects involved.
6. **Create** → copy the **Client ID** (`123…apps.googleusercontent.com`).

### A5. Drop the client ID into TaskFlow

In `frontend/.env`:

```bash
VITE_GOOGLE_CLIENT_ID=123456789012-abc….apps.googleusercontent.com
```

Restart the dev server or trigger a production rebuild — done. The
"Sign in with Google" button now appears on **Settings → Integrations** and
the **Calendar** page for every user.

---

## B · Every-user experience (no setup, ~3 clicks)

This is what your users see:

1. Sign in to TaskFlow.
2. Open **Settings** (or **Calendar**). A card shows the Google G logo and
   a single **"Sign in with Google"** button.
3. Click it → standard Google popup appears with **whatever Gmail
   accounts they're already signed into in this browser**, plus an option
   to use another account.
4. Pick the Gmail → grant the *Calendar events* scope → popup closes →
   the card flips to green **"Connected · user@example.com"**.

From now on, the **New Meeting** modal shows a *"Also add to my Google
Calendar"* toggle (on by default). Every meeting they create with the
toggle on lands in their Google Calendar at the chosen date + time.

To **switch accounts** or **disconnect**, the same card has those buttons
right next to the connected email.

That's the whole user experience — no manual config, no API key entry,
nothing copy-pasted.

---

## How it works under the hood

- TaskFlow loads Google Identity Services
  (`https://accounts.google.com/gsi/client`) in `index.html`.
- "Sign in with Google" opens a popup against your OAuth client. The user
  picks an account and grants the `calendar.events` scope.
- TaskFlow receives a **short-lived access token** (≈1 hour) and caches it
  in `localStorage`, keyed per TaskFlow profile.
- Calendar API calls go **directly from the user's browser to
  `googleapis.com`** — your TaskFlow backend never sees the token.
- When the token expires, the next Calendar call silently re-issues it (no
  popup if the user is still signed into Google).
- **Disconnect** revokes the token via Google's revoke endpoint and clears
  the local cache, so the user can pick a different account next time.

This matches the boundary used by Calendly, Notion, and similar products
for personal calendar sync.

---

## Troubleshooting

- **"Google Calendar not configured by admin"** — `VITE_GOOGLE_CLIENT_ID`
  is missing from `frontend/.env`. Run step A5 and rebuild.
- **`redirect_uri_mismatch` / `origin mismatch`** — the browser's current
  URL isn't listed in step A4. Add the exact origin (scheme + host + port,
  no trailing slash) and retry.
- **`access_denied`** — your OAuth consent screen is in *Testing* mode and
  the user's Gmail isn't in the test-users list. Add them or publish the
  app.
- **Token expired** — TaskFlow silently re-requests on the next call. If
  the user is signed out of Google entirely, they'll see one popup again.
- **Two users on one browser** — each TaskFlow profile gets its own cache
  key (`taskflow_gcal:<userId>`), so user-switch in TaskFlow doesn't
  inherit the previous user's Google connection.

---

## What's exactly sent to Google

Per meeting, exactly one request:

```
POST https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all
Authorization: Bearer <user's access_token>

{
  "summary": "<meeting title>",
  "description": "<meeting description>",
  "start": { "dateTime": "<ISO timestamp>" },
  "end":   { "dateTime": "<ISO + 60 min>" },
  "reminders": { "useDefault": true }
}
```

No attendees are added by default (TaskFlow employee emails are not exposed
to the browser context that builds this payload). If you want invitee
emails on the Calendar event, extend the `createEvent()` call in
`frontend/src/lib/googleCalendar.js`.

---

## Code map

- `frontend/src/lib/googleCalendar.js` — OAuth + Calendar API client.
- `frontend/src/components/GoogleConnectCard.jsx` — reusable "Sign in with
  Google" card + connected-state panel.
- `frontend/src/components/NotificationSettings.jsx` — Settings page,
  hosts the connect card under an **Integrations** section.
- `frontend/src/components/CalenderView.jsx` — Calendar page header,
  hosts the inline variant of the card.
- `frontend/src/components/MeetingForm.jsx` — toggle on the New Meeting
  modal that pushes a Calendar event after the TaskFlow meeting is saved.
- `frontend/index.html` — loads `https://accounts.google.com/gsi/client`.
- `frontend/.env.example` — declares the optional `VITE_GOOGLE_CLIENT_ID`.
