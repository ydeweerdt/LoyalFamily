# LoyalFamily — User & Deployment Guide

Self-hosted loyalty-card manager for a single family. One container, one SQLite
file, no external services.

---

## 1. Requirements

The **only** host requirement is Docker (with `docker compose`). No Node, no
native toolchain — builds, tests and the runtime all happen in containers.

## 2. Quick start

```bash
git clone <your-repo> && cd LoyalFamily
make run          # builds the image and starts it via docker compose
```

Open `http://localhost:3000`:

1. **The first account you register becomes the administrator** (registration
   closes for everyone after that — new people join only through invite links).
2. Add cards with **＋** (scan the barcode or type the number).
3. Invite family members: **Admin → Create invite link** → share the one-time
   link (valid 7 days).

Before using this beyond a quick trial, set a real `COOKIE_SECRET`: put it in an
untracked `.env` next to `docker-compose.yaml` (see §4).

## 3. Daily use

| Task | How |
|---|---|
| Show a card at the checkout | Tap its tile → full-screen barcode (hold the tile to manage instead) |
| Add a card | **＋** → pick brand (search works) → scan or type value → confirm |
| Share a card | Check “shared” when adding/editing — shared cards are visible to all household members; private cards are visible only to their owner |
| Import from another LoyalFamily instance | **Settings → Export** on the old instance, then **Settings → Import** here |
| Back up | **Settings → Export my cards (JSON)** — the canonical `loyalfamily-json-v1` format, re-importable |
| Install as an app | Browser → “Install app” / “Add to Home Screen” (Android Chrome/Firefox, iOS Safari ≥ 16.4, desktop Chrome/Firefox/Edge). Works offline once installed |
| Language | Auto-detected from the phone/browser (English or Dutch); override in **Settings → Language** (Auto / Nederlands / English) |
| Health check | `GET /api/health` → `{"status":"ok"}` |

Offline behaviour: the app keeps working with your cached cards; changes are
queued and sync automatically when you reconnect (the banner shows how many
changes are waiting). If the server **rejects** a change for good, the banner says
so — "N change(s) could not be saved" — and the card reverts to the server's
version. A rejected change is never silent.

## 4. Configuration (environment variables)

> **HTTP vs HTTPS matters.** Browsers only expose the secure-context APIs this
> app leans on — service worker (offline), camera scanner, PWA install — on
> `https://` or `localhost`. Plain `http://192.168.x.x:3000` still lets you
> browse and manage cards, but the scanner and offline mode will be dead.
> For real family use, put the container behind your TLS proxy (§6) or use
> Tailscale Serve.

Set these in `.env` next to `docker-compose.yaml` (`echo "COOKIE_SECRET=$(openssl rand -hex 32)" > .env`) or in your orchestrator:

| Variable | Default | Meaning |
|---|---|---|
| `COOKIE_SECRET` | — **required** | Signs session cookies. Must be ≥ 32 chars. Generate: `openssl rand -hex 32`. Rotating it logs everyone out |
| `PUBLIC_URL` | `http://localhost:3000` | The URL users actually browse at. **Set it to your `https://…` URL when behind a TLS proxy** — session cookies automatically get the `Secure` flag (and the `__Host-` prefix) when it starts with `https` |
| `DATA_DIR` | `/data` | Where the SQLite database lives (the container's volume). **Local block storage only** — never an NFS/CIFS/NAS mount, and never the same volume in two containers: SQLite has no multi-process writers and it will corrupt silently |
| `PORT` | `8080` | Port the server listens on *inside* the container |
| `TZ` | `Europe/Brussels` | Timezone for timestamps in logs |
| `RESET_ADMIN` + `RESET_ADMIN_PASSWORD` | unset | **Break-glass only** (§7): resets one user's password at startup. Remove both after one start — while they are set, every restart repeats the reset |

## 5. Data & backups

All state is one SQLite file inside the `loyalfamily-data` named volume
(`loyalfamily.db`, plus its `-wal`/`-shm` companions). The volume holds every card
number of the household in plaintext: keep the disk encrypted and keep backups out
of unencrypted cloud storage.

1. **File-level, safe while running** — use SQLite's own backup API, not `cp`:
   ```bash
   make backup     # docker exec loyalfamily node -e "…db.backup('/data/backup-<date>.db')"
   ```
   A hot copy of `loyalfamily.db` alone is **not** safe: freshly committed rows can
   still be sitting in the `-wal` file.

   Offline alternative (container stopped) — then the plain file copy is fine:
   ```bash
   docker compose down
   docker run --rm -v loyalfamily-data:/data -v $PWD:/backup alpine \
     tar czf /backup/loyalfamily-backup.tgz -C /data .
   ```

2. **Application-level:** Settings → Export (JSON). Survives a full reinstall;
   import recreates every card (as cards owned by whoever imports them).

**Restore drill** — do it once before you need it:

```bash
docker compose down
docker run --rm -v loyalfamily-data:/data alpine sh -c \
  'cp /data/backup-<date>.db /data/loyalfamily.db; rm -f /data/loyalfamily.db-wal /data/loyalfamily.db-shm'
docker compose up
```

Then log in and check the cards are there. A backup you have not restored is not a
backup.

## 6. Production deployment (home server + HTTPS)

Recommended shape: this container behind your home reverse proxy with TLS
(needed for iOS PWA install comfort and `Secure` cookies).

`docker-compose.yaml` (excerpt):

```yaml
services:
  loyalfamily:
    image: loyalfamily:latest
    build: .
    ports:
      - "3000:8080"          # host port your proxy points at
    environment:
      COOKIE_SECRET: ${COOKIE_SECRET:?see .env}   # real value lives in .env
      PUBLIC_URL: https://loyalfamily.example.net
      TZ: Europe/Brussels
    volumes:
      - loyalfamily-data:/data
    restart: unless-stopped
```

Caddy reverse proxy example:

```
loyalfamily.example.net {
    reverse_proxy localhost:3000
}
```

(nginx: proxy_pass to `http://localhost:3000` with the usual
`proxy_set_header X-Forwarded-Proto $scheme`. Note the app itself does not read
`X-Forwarded-Proto` — cookie security follows `PUBLIC_URL`.)

The app ships one limiter of its own: 5 failed logins (or failed password changes)
from the same IP freeze that username+IP pair for 15 minutes. It is in-process — a
counter restart clears it — so for anything reachable from the open internet add a
limiter at the proxy too (Caddy needs the [caddy-ratelimit](https://github.com/caddyserver/caddy-ratelimit)
plugin; nginx `limit_req`).

The container runs as a non-root user, has a built-in healthcheck against
`/api/health`, and writes only to `/data`. A read-only rootfs
(`read_only: true` + the `/data` volume) is a hardening step that is **not yet
verified** against this image — try it on a test instance first.

### Upgrading

```bash
git pull
make run        # rebuilds the image, restarts the service; data volume untouched
```

Migrations run automatically at startup. Downgrade safety: take a file backup
first if you ever need to roll back.

## 7. Admin duties

The admin panel (**Admin** in the nav) can:

- create/revoke invite links (single-use, 7-day expiry)
- promote/demote users (the last admin can't be demoted)
- reset any user's password (there is no email recovery — that's deliberate)
- delete a user **and all of their cards** (private included)
- delete any card (cleanup override; only owners can *edit*)

Every signed-in user can change their own password under **Settings**.

**Sessions are revoked, not expired.** Resetting someone's password, promoting or
demoting them, or deleting them invalidates every session cookie they already have
— a removed family member does not keep access for 30 days. Changing your own
password keeps *this* device signed in and signs out your other devices.

### If the admin's password is lost

There is no email recovery, and the last admin can neither be demoted nor removed
— so a lost admin password would lock the family out of its own data. The
break-glass is a one-shot reset at container start:

```bash
docker compose down
RESET_ADMIN=alice RESET_ADMIN_PASSWORD='newpassword1' docker compose up --build -d
docker compose logs loyalfamily | grep -i reset     # confirm + see the warning
```

Then **remove `RESET_ADMIN`/`RESET_ADMIN_PASSWORD`** from your environment: while
they are set, every restart resets that password again.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `COOKIE_SECRET must be set …` at startup | Set the variable (§4) |
| Login answers “too many failed attempts” (429) | 5 wrong passwords from that IP; wait 15 minutes (§6) or restart the container |
| Login drops you off / cookie rejected over HTTPS | `PUBLIC_URL` must start with `https` when you serve HTTPS |
| “Offline — N changes waiting to sync” never clears | Server unreachable or the queued op was rejected; reload once the server is reachable — invalid queued ops are dropped and the server truth is pulled |
| “N change(s) could not be saved” | The server rejected that mutation for good (bad value, card deleted, not your card). The card shows the server's version; re-apply the edit if it was legitimate |
| Scanner does nothing on iOS/Firefox | Expected first prompt: allow camera; the ZXing fallback decoder kicks in automatically when the native `BarcodeDetector` is missing |
| Barcode looks like text, not bars | The stored value is invalid for its symbology (e.g. wrong EAN-13 check digit) — the app shows the readable value instead of a broken barcode; fix the value in Edit |
