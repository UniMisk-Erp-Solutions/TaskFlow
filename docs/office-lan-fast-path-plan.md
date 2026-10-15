# Office LAN Fast Path (Plan and Findings)

## Goal

Users inside the office should reach the TaskFlow backend over the local network (1 Gbps) instead of going out through Cloudflare, which limits uploads to about 200. Users outside the office keep using Cloudflare unchanged. No application code changes.

## Findings (read-only scan of the server)

- Server `Olympus` is on the office LAN: `192.168.23.15/24` (also `.14`), default gateway and DNS `192.168.23.254`. Link speed 1000 Mb/s.
- Public traffic reaches it through a **Cloudflare Tunnel** (`cloudflared`) that forwards `taskflow-backend.unimisk.com` to Coolify's Traefik on `127.0.0.1:80`.
- Traefik (`coolify-proxy`) already listens on ports 80 and 443 on all interfaces. It is shared by other projects.
- Uploads, storage and Realtime all use `taskflow-backend.unimisk.com`. The frontend is hosted elsewhere and can keep loading from the internet.

## Approach: split DNS

1. **Office DNS override** (router `192.168.23.254`): `taskflow-backend.unimisk.com -> 192.168.23.15`. Outside DNS is untouched.
2. **Trusted certificate on the server**: obtain a Let's Encrypt certificate for the hostname by DNS challenge (needs a Cloudflare API token limited to DNS edit on `unimisk.com`), place it in Traefik's live-reload dynamic config directory (additive; no restart and no change to other projects), and renew it on a schedule.
3. **Verify**: HTTPS from a LAN client to the server, and compare upload speed on LAN versus via Cloudflare.

A trusted certificate is required: browsers reject Cloudflare origin certificates, and microphone/clipboard features need HTTPS.

## Rollback

Remove the added certificate files and dynamic config entry, and delete the router DNS record.

## Status

Planned. Blocked on: the Cloudflare DNS-edit token being stored on the server (`~/cf-dns-token`) and the router DNS record. Nothing on the server has been changed for this feature yet.
