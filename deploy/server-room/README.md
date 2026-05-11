# Server room: permanent tunnel + boot autostart

This folder configures:

1. **Named Cloudflare Tunnel** — stable `https://api.yourdomain.com` (no random `trycloudflare.com` URLs).
2. **systemd** — after power returns and the PC reboots, **Docker**, **local Supabase**, **Edge function `api`**, and **cloudflared** come up without manual commands.

Coolify is usually already installed as a systemd service; if `docker` starts on boot, Coolify stacks follow your Coolify project settings. This guide adds **Taskflow’s Supabase CLI stack** and **tunnel** explicitly.

---

## Prerequisites

- Ubuntu/Debian PC with Docker running on boot (`sudo systemctl enable docker`).
- A **domain** on Cloudflare (DNS there).
- `cloudflared` (install: `sudo apt install cloudflared` or use the official Cloudflare package).
- Node + npm (`npx supabase` works from your Taskflow repo).

---

## Part A — Permanent Cloudflare tunnel (one-time)

Replace `api.example.com` and paths with yours.

### 1) Login to Cloudflare (browser, once)

```bash
cloudflared tunnel login
```

### 2) Create a named tunnel

```bash
cloudflared tunnel create taskflow-supabase
```

Note the **Tunnel ID** printed. Cloudflare also creates  
`~/.cloudflared/<TUNNEL_ID>.json` (credentials).

### 3) Route DNS to the tunnel

```bash
cloudflared tunnel route dns taskflow-supabase api.example.com
```

(Use your real hostname, e.g. `supabase.yourcompany.com`.)

### 4) Install tunnel config

```bash
sudo mkdir -p /etc/cloudflared
sudo cp deploy/server-room/cloudflared/config.yml.example /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml
```

Edit:

- `tunnel:` → your **Tunnel ID** (UUID).
- `credentials-file:` → full path to `~/.cloudflared/<TUNNEL_ID>.json` (expand `~` to `/home/youruser/...`).
- `hostname:` → `api.example.com` (same as DNS route).
- `service:` → `http://127.0.0.1:54321` (local Kong / Supabase gateway).

### 5) Install and enable cloudflared systemd service

```bash
sudo cp deploy/server-room/systemd/cloudflared.service /etc/systemd/system/cloudflared.service
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared.service
sudo systemctl status cloudflared.service
```

Test from **outside** your LAN:

```bash
curl -sS "https://api.example.com/functions/v1/api"
```

Expect: `{"ok":true,"service":"edge-api"}` (or your function’s health JSON).

---

## Part B — Autostart Supabase + Edge `api` (boot)

### 1) Configure install paths

Open `install-autostart.sh` and set `TASKFLOW_USER` and `TASKFLOW_ROOT`, **or** export when running:

```bash
export TASKFLOW_USER=mithilmistry
export TASKFLOW_ROOT=/home/mithilmistry/Downloads/taskflow
sudo -E bash deploy/server-room/install-autostart.sh
```

The script copies systemd units to `/etc/systemd/system/`, enables them, and starts them.

### 2) Boot order

| Unit | Role |
|------|------|
| `docker.service` | Docker (Coolify + containers). |
| `taskflow-supabase.service` | `npx supabase start` in repo (oneshot, `RemainAfterExit=yes`). |
| `taskflow-edge-api.service` | `npx supabase functions serve api --no-verify-jwt` (`Restart=always`). |
| `cloudflared.service` | Public HTTPS → `127.0.0.1:54321`. |

`taskflow-edge-api` starts **after** `taskflow-supabase` so Kong and DB exist first.

### 3) Logs

```bash
journalctl -u taskflow-supabase.service -b
journalctl -u taskflow-edge-api.service -f
journalctl -u cloudflared.service -f
```

---

## Part C — Vercel (production env)

Set **Production** environment variables to your **permanent** tunnel host (HTTPS):

- `VITE_SUPABASE_URL` = `https://api.example.com`
- `VITE_API_URL` = `https://api.example.com/functions/v1/api`
- `VITE_SUPABASE_ANON_KEY` = anon key from `npx supabase status -o env` on the server (same stack the tunnel hits).

Redeploy the Vercel project after any URL or key change.

Also allow your Vercel app URL in Supabase Auth redirects (`supabase/config.toml` locally, or matching settings if you later use hosted Supabase).

---

## Power loss / UPS

systemd brings services back **after** the OS boots. For fewer brownouts:

- Use a **UPS** on the server-room PC.
- BIOS: **Restore on AC power** = Power On (so the machine boots when mains return).

---

## Security notes

- The tunnel exposes **Kong** on `54321`. Keep RLS strict; never put **service_role** in the frontend.
- Restrict `cloudflared` ingress to only the hostnames you need (single hostname to Supabase is enough for this app).
