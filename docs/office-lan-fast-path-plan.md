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

## Status (17/10/2026)

**Server side DONE, office DNS step still TODO.**

Done on the server:
- Added `/traefik/dynamic/taskflow-backend-lan.yaml` inside the `coolify-proxy` container (Traefik file provider, live reload). It adds an HTTPS router for `taskflow-backend.unimisk.com` only, pointing to TaskFlow's Kong (`supabase-kong-l5srp6yqmhmj7kf1dqbtsaxf:8000`), with `certResolver: letsencrypt`. Traefik already had a Let's Encrypt HTTP-challenge resolver, so no Cloudflare API token was needed; the certificate was issued through the existing tunnel.
- The public path (Cloudflare tunnel to Traefik on port 80) is unchanged.
- Verified from a PC on the office network with `curl --resolve taskflow-backend.unimisk.com:443:192.168.23.15`: HTTPS answers with a **trusted certificate** (verify OK). Health endpoint timing, 3 runs: LAN about 0.03 to 0.06 s total (2 ms connect) versus Cloudflare 0.68 to 0.95 s (150 ms connect).
- Large-upload throughput was not measured reliably; no verified MB/s figure exists yet.

Still to do (needs the office router): add the DNS record `taskflow-backend.unimisk.com -> 192.168.23.15` on `192.168.23.254`. Until then office PCs keep resolving the public (Cloudflare) address. After adding it, flush DNS on a client (`ipconfig /flushdns`) and check `nslookup taskflow-backend.unimisk.com` returns `192.168.23.15`.

Rollback: delete `/traefik/dynamic/taskflow-backend-lan.yaml` in the `coolify-proxy` container (and the router DNS record).
