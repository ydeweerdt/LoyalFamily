# LoyalFamily — Technical Design

Requirements: see [REQUIREMENTS.md](REQUIREMENTS.md). Stack: SvelteKit (adapter-node)
+ better-sqlite3 + TypeScript, single deployable, one Docker container.

## 1. Screens / flow

```
[Login / Register / Join-via-invite]
        │
   [Home grid]──────────────────────┐  continuous scroll, alphabetical brand tiles,
        │                           │  count badge, 🔒 on own private cards
        │ tap "+"                   │
   [Brand picker] (logo grid + search + "Unknown")
        │ pick brand                │
   [Scanner] (camera; manual-entry fallback link)
        │ scan OK                   │
   [Card confirm form] (barcode preview, value, symbology,
        │                         shared checkbox default OFF, comment field)
        │ save                      │
   [Home grid] ◄────────────────────┘
        │ tap tile (1 card)         → [Barcode view] fullscreen, wake lock, white max-contrast
        │ tap tile (multi card)     → [Brand card list] → [Barcode view]
        │ long-press / menu         → [Card edit] (owner only) / delete
        │ menu                      → [Admin] users, invites, delete-any-card
```

Offline: everything above works except brand-picker is local data (bundled),
scanner works offline (card queued), barcode view always works from cache.

## 2. Data model (SQLite)

```sql
users (
  id INTEGER PK,
  username TEXT UNIQUE NOT NULL,        -- login handle
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,          -- argon2id
  role TEXT NOT NULL DEFAULT 'user',    -- 'admin' | 'user'
  created_at TEXT NOT NULL
);

invites (
  id INTEGER PK,
  token TEXT UNIQUE NOT NULL,           -- random 128-bit, in the join URL
  created_by INTEGER REFERENCES users(id),
  expires_at TEXT NOT NULL,             -- created_at + 7 days
  used_by INTEGER REFERENCES users(id), -- NULL until redeemed (single-use)
  used_at TEXT
);

cards (
  id INTEGER PK,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  brand_id TEXT,                        -- catalog id, NULL for custom/"Unknown"
  name TEXT NOT NULL,                   -- brand name or free text
  color TEXT NOT NULL,                  -- #rrggbb tile background
  barcode_value TEXT NOT NULL,
  symbology TEXT NOT NULL,              -- EAN_13 | UPC_A | CODE_128 | CODE_39 | QR | ...
  visibility TEXT NOT NULL DEFAULT 'private',  -- 'private' | 'shared'
  comment TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,             -- last-write-wins clock (server-assigned)
  updated_by INTEGER NOT NULL REFERENCES users(id),
  deleted_at TEXT                       -- soft delete, for sync tombstones
);

sync_queue (                                -- client-side only (IndexedDB), shown here for symmetry
  card_id, op ('create'|'update'|'delete'), payload, base_updated_at, queued_at
);
```

Visibility rule for every read: `owner_id = me OR visibility = 'shared'`.

## 3. API (JSON, session-cookie auth)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/register` | allowed only while `users` is empty → first user becomes admin |
| POST | `/api/join` | redeem invite token → create user (username, display name, password) |
| POST | `/api/login`, POST | `/api/logout` | session cookie (HttpOnly, SameSite=Lax, Secure) |
| GET | `/api/brands` | curated brand catalog (static, also bundled in the PWA) |
| GET | `/api/cards?since=<iso>` | **sync pull**: my visible cards incl. tombstones changed since `<iso>` |
| POST | `/api/cards` | create; server assigns id, `updated_at` |
| PUT | `/api/cards/:id` | update; requires owner; body carries `base_updated_at` → 409 if stale |
| DELETE | `/api/cards/:id` | owner or admin; soft delete (tombstone) |
| GET | `/api/admin/users`, PUT `/api/admin/users/:id` (role), DELETE `/api/admin/users/:id` | admin only |
| POST | `/api/admin/invites` → GET `/api/admin/invites` | create/list/revoke invites |
| GET | `/api/export` | full JSON export (my cards + brands) — backup/adoption |
| POST | `/api/import` | LoyalFamily JSON export (`loyalfamily-json-v1`) → creates cards owned by importer |

## 4. Sync protocol (deliberately simple)

- Client keeps `lastSyncAt` and a full local copy of its visible cards.
- **Pull**: on app open (and after any successful push): `GET /api/cards?since=lastSyncAt`
  → apply inserts/updates/tombstones → update IndexedDB → UI re-renders.
- **Push**: mutations are applied locally immediately (optimistic), then enqueued.
  Queue drains FIFO whenever online. Server is authority:
  - create → server assigns `updated_at`
  - update → if `base_updated_at` ≠ server's, server accepts anyway **last-write-wins**
    (owner is the only writer except admin deletes; conflicts are rare and low-stakes)
  - 404 on update of deleted card → client drops the queue item, pulls.
- No WebSockets. A background Sync on `online` event + on visibilitychange.

## 5. Offline architecture

- Service Worker (SvelteKit PWA adapter): precache app shell, brand logos, fonts.
- IndexedDB stores: `cards`, `syncQueue`, `meta(lastSyncAt)`.
- Home grid and barcode view render purely from IndexedDB — zero network needed.
- Barcode view: `requestFullscreen()` + `navigator.wakeLock` (Chrome/Edge; not
  available on iOS Safari — degrade gracefully), white background, wide quiet zone,
  one-time brightness hint toast.
- Barcode rendering: JsBarcode (EAN-13/UPC-A/Code128/Code39, SVG) + `qrcode` for QR.
- Scanning: `BarcodeDetector` if available; else ZXing-WASM (e.g. `@zxing/library`).
  Offline scan → card saved locally with `pending` flag → synced later.

## 6. Security

- argon2id password hashing; generic error messages (no user enumeration).
- Session: HttpOnly + Secure + SameSite=Lax cookie; CSRF token on mutations.
- Invite tokens: 128-bit random, single-use, 7-day expiry, never logged.
- Card values never in URLs; API requires auth except `/api/register`, `/api/join`.
- Rate-limit login/invite endpoints. HTTPS expected at reverse proxy (Caddy).

## 7. Deployment (Docker)

- Multi-stage Dockerfile → slim Node LTS runtime image, version-tagged.
- Stateless image; volume mounted at `DATA_DIR` (default `/data`) holding
  `loyalfamily.db` (+ WAL files).
- Config via env only: `PORT`, `DATA_DIR`, `COOKIE_SECRET`, `PUBLIC_URL`, `TZ`.
- Repo ships `docker-compose.yaml` example (port mapping + volume + healthcheck).
- `GET /api/health` (no auth) for Docker/compose healthcheck.
- SIGTERM handler → close SQLite cleanly (WAL checkpoint) so the DB file is safe
  to copy.
- Schema migrations (plain SQL files, versioned table) run automatically on start.
- TLS at the reverse proxy (Caddy example in docs); app trusts `X-Forwarded-Proto`.
- Backup: copy `loyalfamily.db` from the volume; restore: copy back. Documented one-liner.
- Resource target: comfortable on Raspberry Pi-class hardware (≤ 256 MB RAM).

## 8. Build order (suggested milestones)

1. Scaffold SvelteKit + SQLite schema + auth (register/login/first-admin)
2. Home grid + brand catalog + card CRUD (online only)
3. Barcode rendering + full-screen barcode view
4. Scanner (BarcodeDetector + ZXing fallback) + confirm form
5. PWA: manifest, Service Worker, IndexedDB cache, offline view
6. Sync queue + `since` pull + tombstones
7. Invites + admin UI
8. LoyalFamily JSON import + export
9. Polish: badges, search, wake lock/fullscreen barcode view, empty states
