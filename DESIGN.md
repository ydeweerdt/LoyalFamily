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
        │ tap tile (multi card)     → [Brand tile view: grid of card tiles] → tap card tile → [Barcode view]
        │ long-press tile / card tile → [Card edit] (owner only; delete inside edit)
        │ menu                      → [Admin] users (roles, password reset, remove),
        │                             invites, delete-any-card
```

Offline: everything above works except brand-picker is local data (bundled),
scanner works offline (card queued), barcode view always works from cache.

## 2. Data model (SQLite)

```sql
users (
  id TEXT PK,                           -- UUID
  username TEXT UNIQUE NOT NULL,        -- login handle
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,          -- argon2id
  role TEXT NOT NULL DEFAULT 'user',    -- 'admin' | 'user'
  created_at TEXT NOT NULL
);

invites (
  id TEXT PK,                           -- UUID
  token TEXT UNIQUE NOT NULL,           -- random 128-bit, in the join URL
  created_by TEXT REFERENCES users(id),
  expires_at TEXT NOT NULL,             -- created_at + 7 days
  used_by TEXT REFERENCES users(id),    -- NULL until redeemed (single-use)
  used_at TEXT
);

cards (
  id TEXT PK,                           -- UUID, client-generated (stable across offline create)
  owner_id TEXT NOT NULL REFERENCES users(id),
  brand_id TEXT,                        -- catalog id, NULL for custom/"Unknown"
  name TEXT NOT NULL,                   -- brand name or free text
  color TEXT NOT NULL,                  -- #rrggbb tile background
  barcode_value TEXT NOT NULL,
  symbology TEXT NOT NULL,              -- EAN_13 | UPC_A | CODE_128 | CODE_39 | QR
  visibility TEXT NOT NULL DEFAULT 'private',  -- 'private' | 'shared'
  comment TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,             -- last-write-wins clock (server-assigned, UTC ISO)
  updated_by TEXT NOT NULL REFERENCES users(id),
  deleted_at TEXT                       -- soft delete, for sync tombstones
);

sync_queue (                                -- client-side only (IndexedDB), shown here for symmetry
  card_id, op ('create'|'update'|'delete'), payload, queued_at
);
```

Visibility rule for every read: `owner_id = me OR visibility = 'shared'`.

## 3. API (JSON, session-cookie auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | no auth; Docker healthcheck |
| POST | `/api/register` | allowed only while `users` is empty → first user becomes admin |
| POST | `/api/join` | redeem invite token → create user (username, display name, password) |
| POST | `/api/login`, `/api/logout` | session cookie (HttpOnly, SameSite=Lax, Secure) |
| GET | `/api/me` | current user (id, display name, role) — app boot |
| POST | `/api/me/password` | change own password (requires current password) |
| GET | `/api/brands` | curated brand catalog (static, also bundled in the PWA) |
| GET | `/api/cards` | **full pull**: complete set of live cards visible to me (tombstones stay server-side; full replacement makes them unnecessary on the client) |
| POST | `/api/cards` | create with **client-generated UUID id**; 409 only on id collision |
| PUT | `/api/cards/:id` | owner only; server accepts (last-write-wins), assigns `updated_at` |
| DELETE | `/api/cards/:id` | owner or admin; soft delete (tombstone) |
| GET | `/api/admin/users` | admin only |
| PUT | `/api/admin/users/:id` | role change or password reset; **cannot demote/remove last admin** |
| DELETE | `/api/admin/users/:id` | **cascades: deletes all cards owned by that user** |
| POST | `/api/admin/invites`, GET `/api/admin/invites` | create/list/revoke invites |
| GET | `/api/export` | full JSON export (my cards + brands) — backup/adoption |
| POST | `/api/import` | LoyalFamily JSON export (`loyalfamily-json-v1`) → creates cards owned by importer |

## 4. Sync protocol (deliberately simple)

- Client keeps a full local copy of its visible cards + a `lastSyncAt` timestamp
  (for UI "synced" display only, not for delta logic).
- **Pull**: on app open, after any successful push, and on `online`/visibilitychange:
  `GET /api/cards` (full visible live set) → replace IndexedDB store →
  UI re-renders. Full replacement converges every device in one step and correctly
  handles: shared→private toggles, user removal cascades, admin deletes.
- **Push**: mutations applied locally immediately (optimistic), enqueued FIFO.
  Card IDs are client-generated UUIDs → an offline-created card keeps the same ID
  from cradle to server; no ID mapping anywhere.
  Server rules:
  - create → validate, insert (409 only on UUID collision)
  - update → accepted if caller is owner; **last-write-wins**, server assigns
    `updated_at` (no optimistic-locking 409s — the owner is the only writer)
  - update/delete of unknown or already-deleted card → 404 → client drops the
    queue item and pulls
- No WebSockets. Sync triggers: app open, `online` event, visibilitychange, after push.
- At ≤ 100 cards the full payload is a few KB; delta sync is a non-goal.

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

- **One multi-stage Dockerfile** used for dev, test and production:

  ```
  base   (node:LTS-alpine, shared layer)
  deps   (package.json + lock, full install incl. build tools)
  build  (svelte-kit build → compiled app)
  test   (lint + typecheck + vitest unit/integration)
  e2e    (playwright against the built app; heavier image, never shipped)
  runtime (node:LTS-alpine: compiled app + prod deps + better-sqlite3 prebuilt
           binary from build stage; non-root user; read-only rootfs; app layer ≤ ~40 MB
           (measured: 26 MB prod node_modules + 7 MB build; 65 MB compressed pull size —
           the node:22-alpine base is ~238 MB uncompressed and is the floor)
  ```

  - local & CI run identical targets: `docker build --target test .`,
    `docker build -t loyalfamily:X .`
  - `Makefile`: `make test`, `make e2e`, `make build`, `make run` (all Docker-wrapped;
    no host Node/npm)
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

## 8. Testable architecture

Module boundaries chosen so the risky logic is testable without browser/camera/network:

```
src/lib/domain/        pure TS, zero SvelteKit/Node imports → 100% unit-testable
  permissions.ts       canView/canEdit/canDelete/canToggle(user, card)
  sync.ts              merge/last-write-wins/tombstone rules (pure functions)
  symbology.ts         validation, brand→symbology hints
  import.ts            LoyalFamily JSON parser (pure: text in → cards out)
src/lib/ports/         interfaces (injectable, faked in tests)
  CardRepo             SQLite-backed impl in src/server/ (better-sqlite3)
  BarcodeDetectorPort  real: BarcodeDetector | zxing fallback; fake in tests
src/routes/api/        thin HTTP layer: parse → call domain → repo
```

Tooling:

- **Vitest** unit tests (domain, parsers) + integration tests (API against
  in-memory SQLite via `better-sqlite3 :memory:`).
- **Playwright** e2e: the 4 critical flows from REQUIREMENTS §11, incl. an
  offline scenario (`context.setOffline(true)`) against the built PWA.
- **Barcode round-trip suite**: JsBarcode/qrcode render → `@zxing/library` (Node)
  decode → assert equality, one test per symbology incl. edge cases (short codes,
  checksum digits, non-ASCII in QR).
- Scanner fallback: fixture images (repo `tests/fixtures/*.jpg`) decoded headlessly.
- Migration tests: fixture DBs per released version, `migrate(fixture)` in CI.
- API types shared via TS (no codegen needed — single repo, single language).

CI (GitHub Actions or a Gitea runner):
identical to local — `docker build --target test .`, `docker build --target e2e .`,
then the runtime image build; on every push.
Release = tag → publish image. `CHANGELOG.md` maintained per release to make
rollback decisions easy.

## 9. Build order (suggested milestones)

1. ✅ Scaffold SvelteKit + SQLite schema + auth (register/login/first-admin)
   — with CI pipeline and the API integration-test harness from day one
2. ✅ Home grid + brand catalog + card CRUD (online only)
3. ✅ Barcode rendering + full-screen barcode view + **round-trip test suite**
4. ✅ Scanner (BarcodeDetector + ZXing fallback) + confirm form
5. ✅ PWA: manifest, Service Worker, IndexedDB cache, offline view
6. ✅ Sync: full pull + push queue + tombstones + **offline e2e test**
7. ✅ Invites + admin UI
8. ✅ LoyalFamily JSON import + export + **parser fixture tests**
9. ✅ Polish: badges, search, wake lock/fullscreen barcode view, empty states
10. ✅ Playwright e2e golden flows (`make e2e`, tests/e2e/01–04): first-admin +
    invite/join, add-card + barcode view, offline → reconnect sync, shared vs
    private across users — found and fixed two real offline bugs: the session
    was unknown offline (now hydrated from a display-only localStorage mirror)
    and optimistic mutations weren't persisted to the IndexedDB mirror (a
    remount while offline lost them from the local UI)
