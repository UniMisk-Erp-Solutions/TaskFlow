# Google Calendar sync — setup guide

TaskFlow can push a Google Calendar event for any new meeting if the user has
connected their Google account. The integration is **browser-only**:

- The frontend uses Google Identity Services (GIS) to request a short-lived
  access token from the user.
- Calendar API calls go directly from the user's browser to
  `https://www.googleapis.com/calendar/v3` — your TaskFlow backend never sees
  the token or the calendar data.
- Each TaskFlow profile caches its own token in `localStorage`. Two people on
  the same device get isolated connections.

No DB migration. No edge-function change. Only one frontend env var.

---

## 1) Create a Google Cloud project (one-time)

1. Open <https://console.cloud.google.com/>.
2. Top-left project picker → **New Project** → name it (e.g. "TaskFlow") →
   **Create**.

## 2) Enable the Google Calendar API

1. In the project, open **APIs & Services → Library**.
2. Search **"Google Calendar API"** → click it → **Enable**.

## 3) Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. **User type:** *External* (unless your org uses Workspace and you want it
   internal-only).
3. Fill in app name, support email, and developer contact email. Logo /
   homepage / privacy URLs are recommended but not required while testing.
4. **Scopes:** click **Add or remove scopes** → add
   `https://www.googleapis.com/auth/calendar.events`.
5. **Test users:** while the app is in **Testing** mode, add every Gmail
   address that should be able to connect. You can publish later to allow
   anyone with a Google account.
6. Save and continue.

## 4) Create the Web-app OAuth client

1. **APIs & Services → Credentials → + Create credentials → OAuth client ID**.
2. **Application type:** *Web application*.
3. **Name:** anything (e.g. "TaskFlow web").
4. **Authorized JavaScript origins:** add **every URL your frontend is served
   from**, with no trailing slash. Examples:
   - `http://localhost:5173` (Vite dev)
   - `http://192.168.16.112:5173` (LAN testing)
   - `https://your-task-flow.example.com` (production)
5. **Authorized redirect URIs:** leave empty. TaskFlow uses the GIS token
   client flow, which doesn't use redirects.
6. Create → copy the **Client ID** (looks like
   `123456789012-abc….apps.googleusercontent.com`).

## 5) Wire the client ID into TaskFlow

In `frontend/.env`:

```bash
VITE_GOOGLE_CLIENT_ID=123456789012-abc….apps.googleusercontent.com
```

Restart `npm run dev` (or trigger a fresh production build) so Vite picks up
the new env var.

## 6) Confirm in the UI

1. Sign in to TaskFlow → open the **Calendar** page (admin or employee).
2. The top bar now reads **"Sync with Google Calendar — Connect Google
   Calendar"**. Click it.
3. A Google consent popup appears → pick the Gmail account you want to sync
   with → grant the *Calendar events* scope.
4. The pill turns green and shows the connected email address.
5. Open **New Meeting** → fill in title + date + time + at least one
   participant → flip the **"Also add to my Google Calendar"** toggle (it
   defaults ON once you've connected) → **Create Meeting**.
6. Open Google Calendar in another tab — the event is on the meeting date at
   the meeting time (1-hour default duration).

## Troubleshooting

- **"Google Identity Services failed to load"** — your network is blocking
  `https://accounts.google.com/gsi/client`. Allow that origin or load the
  page from one that can reach it.
- **"redirect_uri_mismatch" / "origin mismatch"** — the URL in your browser
  isn't listed in step 4 *exactly* (scheme + host + port, no trailing slash).
  Add it and re-test.
- **"access_denied"** — the OAuth consent screen is in *Testing* mode and
  the Gmail you used isn't on the test-users list. Add it or publish the app.
- **Token expired after ~1 hour** — TaskFlow silently re-prompts on the next
  Calendar call. If the user is still signed into Google, no popup appears.
  Otherwise the consent popup re-opens.
- **Disconnect** — click *Disconnect* on the Calendar page. This revokes the
  cached token and clears the local cache, so the next connect can pick a
  different account.

## What gets sent to Google

Per meeting, exactly one POST to
`https://www.googleapis.com/calendar/v3/calendars/primary/events`:

```json
{
  "summary": "<meeting title>",
  "description": "<meeting description>",
  "start": { "dateTime": "<ISO timestamp>" },
  "end":   { "dateTime": "<ISO + 60 min>" },
  "reminders": { "useDefault": true }
}
```

No attendees are added by default (Gmail addresses of TaskFlow employees are
not exposed to the browser context that builds this payload). You can extend
`createEvent({ attendees: [...] })` in `frontend/src/lib/googleCalendar.js`
if you want invitee emails on the Calendar event.

## Where the code lives

- `frontend/src/lib/googleCalendar.js` — OAuth + Calendar API client.
- `frontend/src/components/CalenderView.jsx` — "Sync with Google Calendar"
  bar at the top of the calendar page.
- `frontend/src/components/MeetingForm.jsx` — toggle on the New Meeting
  modal that pushes a Calendar event after the TaskFlow meeting is saved.
- `frontend/index.html` — loads `https://accounts.google.com/gsi/client`.
- `frontend/.env` — `VITE_GOOGLE_CLIENT_ID`.
