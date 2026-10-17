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
  token_version INTEGER NOT NULL DEFAULT 0,  -- bumped → every older session cookie dies
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

Migrations are plain SQL files in `src/lib/server/migrations/`, applied in version
order at startup and recorded in `schema_versions`. Never edit an applied one —
add the next file (002 added `token_version` this way).

## 3. API (JSON, session-cookie auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | no auth; Docker healthcheck |
| POST | `/api/register` | allowed only while `users` is empty → first user becomes admin |
| POST | `/api/join` | redeem invite token → create user (username, display name, password) |
| POST | `/api/login`, `/api/logout` | session cookie (HttpOnly, SameSite=Lax, Secure) |
| GET | `/api/me` | current user (id, display name, role) — app boot |
| POST | `/api/me/password` | change own password (requires current password); re-issues the session cookie, kills other devices |
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

The brand catalog is **bundled into the client only** (`src/lib/brands.ts`) — there
is deliberately no `/api/brands`: the offline UI needs the bundled copy anyway, and
a second source of truth for the catalog is a bug waiting to happen.

### Error contract (the client's queue logic depends on it)

All errors are `{ "error": "<human message>" }`; the message is the UI text.

| Status | Meaning | Client behavior |
|---|---|---|
| 400 | invalid input | drop the op, count it in `failed`; the pull reverts the card to server truth |
| 401 | no / expired / revoked session | drop the op; the following pull also fails, so the app shows the offline banner (known gap: it does not yet bounce the user to the login page) |
| 403 | permission denied (not owner / not admin) | drop the op, count it in `failed` |
| 404 | card unknown or already deleted | drop the op, full pull shows the truth |
| 409 | card id already exists / username taken | drop the op (UUID collision ≈ never) |
| 5xx, network | transient | **keep queued**, retried on the next trigger |

4xx is permanent → the op is unqueued and counted in `failed` so the banner says
"N changes could not be saved" (REQUIREMENTS §6 invariant 3). 5xx/network is
retryable → the op stays queued and FIFO order is never reordered.

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

### Invariants

1. Mutations are written to IndexedDB (mirror + queue) **before** they are sent.
2. A full pull replaces the cache **except** for cards that still have a queued
   op: those keep their local version until the server acks it. Without this, a
   pull after a half-failed flush would wipe optimistic changes from the UI.
3. A permanently rejected op (4xx) is unqueued **and counted** (`failed`) so the
   home screen says "N changes could not be saved". Rejections are never silent.

### Failure modes (scenario → server → client → what the user sees)

| Scenario | Server | Client | User sees |
|---|---|---|---|
| offline create → reconnect | 201, same client UUID | unqueue, full pull | card appears once, no id change |
| offline create + rename → reconnect | one 201 (coalesced) | one send | final value only |
| offline edit → card deleted on server meanwhile | 404 | op dropped | card gone + "N changes could not be saved" |
| offline edit rejected by validation | 400 | op dropped | card reverts to server value + failure count |
| network dies mid-flush | — | remaining ops stay queued, FIFO preserved; pull keeps local versions of queued cards | offline banner with pending count |
| same user edits the same card on two devices | last write wins | pull converges | one edit survives, the other silently lost (accepted, REQUIREMENTS §6) |
| card switched shared→private by its owner | — | full pull replaces | the card vanishes from everyone else's grid |
| owner removed by admin | cards hard-deleted, sessions revoked | full pull replaces | cards gone; that user's devices get 401 |

## 5. Offline architecture

- Service Worker (`static/sw.js`): navigations are **network-first** (so a deploy
  is picked up immediately and clients never run a stale app shell against a new
  API); hashed assets (`/_app/**`), icons and the manifest are cache-first;
  `/api/**` is never touched by the SW — offline card data is IndexedDB's job, not
  an HTTP cache's (stale card data in an HTTP cache is exactly the bug class the
  full-pull design removes).
- Known SW limitations, accepted: the shell cache stores only `/`, so an offline
  deep link (`/settings`) serves the home page; the cache name (`loyalfamily-shell-v1`)
  is bumped by hand when the shell shape changes, otherwise old entries linger.
- IndexedDB stores: `cards`, `syncQueue`, `meta(lastSyncAt)`.
- Home grid and barcode view render purely from IndexedDB — zero network needed.
- Barcode view: `requestFullscreen()` + `navigator.wakeLock` (Chrome/Edge; not
  available on iOS Safari — degrade gracefully), white background, wide quiet zone,
  one-time brightness hint toast.
- Barcode rendering parameters (what makes a checkout scanner read it —
  `src/lib/components/Barcode.svelte`): 1D via JsBarcode SVG at `width: 2` px per
  module, `height: 90`, `margin: 10` px quiet zone, human-readable digits under the
  bars; QR via `qrcode` SVG with a 2-module quiet zone and error-correction level M.
  The SVG is scaled to the viewport by CSS, never re-rasterized. Changing any of
  these requires re-running the round-trip suite **and** the manual hardware matrix
  (REQUIREMENTS §5a).
- Barcode rendering: JsBarcode (EAN-13/UPC-A/Code128/Code39, SVG) + `qrcode` for QR.
  An unrenderable value falls back to the raw text + symbology name (REQUIREMENTS §5a).
- Scanning: `BarcodeDetector` if available; else ZXing-WASM (e.g. `@zxing/library`).
  Offline scan → card saved locally with `pending` flag → synced later.
- iOS: Safari can evict a PWA's IndexedDB after long disuse. The full pull makes
  that self-healing for reads; only mutations queued but never pushed would be lost.

## 6. Security

- argon2id password hashing (OWASP parameters); generic error messages (no user
  enumeration).
- Session: signed HMAC cookie, 30-day TTL, HttpOnly + SameSite=Lax, `Secure` and
  the `__Host-` name when `PUBLIC_URL` is https. `COOKIE_SECRET` (≥ 32 chars) is
  required for any session operation — register/login fail without it. Rotating it
  logs everyone out.
- **Revocation**: the cookie carries the user's `token_version`; `sessionUser()`
  re-checks it against the row on every request. `setPasswordHash` and `setUserRole`
  bump it, and deleting a user removes the row — so password resets, promotions,
  demotions and removals kill existing sessions immediately instead of letting them
  live out their 30 days.
- **No CSRF token** (decision, not omission): all mutations are same-origin JSON
  writes and `SameSite=Lax` stops cross-site writes. Revisit if a non-browser
  client ever gets write access.
- **No in-app rate limiting** (decision): delegated to the reverse proxy in front
  of the container. Documented in UserGuide.
- Invite tokens: 128-bit random hex, single-use, 7-day expiry, never logged.
- Card values never in URLs; API requires auth except `/api/register`, `/api/join`.
- Break-glass: `RESET_ADMIN` + `RESET_ADMIN_PASSWORD` reset one user's password at
  startup (`src/lib/server/bootstrap.ts`, run from `src/hooks.server.ts`) — the only
  recovery path when the last admin's password is lost. Loud warning in the logs;
  must be removed from the environment afterwards.

## 7. Deployment (Docker)

- **One multi-stage Dockerfile** used for dev, test and production:

  ```
  base   (node:LTS-alpine, shared layer)
  deps   (package.json + lock, full install incl. build tools)
  build  (svelte-kit build → compiled app)
  test   (lint + typecheck + vitest unit/integration)
  e2e    (playwright against the built app; heavier image, never shipped)
  runtime (node:LTS-alpine: compiled app + prod deps + better-sqlite3 prebuilt
           binary from build stage; non-root user; app layer ≤ ~40 MB
           (measured: 26 MB prod node_modules + 7 MB build; 65 MB compressed pull size —
           the node:22-alpine base is ~238 MB uncompressed and is the floor)
  ```

  A read-only rootfs (writable only `DATA_DIR`) is a **v2 hardening**: the runtime
  stage runs as a non-root user today but does not mount the filesystem read-only.

  - local & CI run identical targets: `docker build --target test .`,
    `docker build -t loyalfamily:X .`
  - `Makefile`: `make test`, `make e2e`, `make build`, `make run`, `make backup`
    (all Docker-wrapped; no host Node/npm)
- Stateless image; volume mounted at `DATA_DIR` (default `/data`) holding
  `loyalfamily.db` (+ WAL files).
- **One container per volume, local storage only.** SQLite/WAL has no multi-process
  writers: never mount the same volume in two containers/stacks, and never put it
  on NFS/CIFS/NAS — that is how a home deploy silently corrupts its database.
- Config via env only: `PORT`, `DATA_DIR`, `COOKIE_SECRET`, `PUBLIC_URL`, `TZ`
  (+ `RESET_ADMIN`/`RESET_ADMIN_PASSWORD` for one start, see §6).
- Repo ships `docker-compose.yaml` example (fixed `container_name`, port mapping +
  volume + healthcheck).
- `GET /api/health` (no auth) for Docker/compose healthcheck.
- SIGTERM handler (`src/hooks.server.ts`) closes SQLite, which checkpoints the WAL —
  the DB file left in the volume is complete.
- Schema migrations (plain SQL files, versioned table) run automatically on start.
- TLS at the reverse proxy (Caddy example in docs). The app does **not** read
  `X-Forwarded-Proto`; cookie `Secure` follows `PUBLIC_URL`, so set `PUBLIC_URL` to
  the real https URL when you put a proxy in front.
- **Backup** (safe while running — a hot `cp` of `loyalfamily.db` can miss data still
  sitting in the `-wal` file):
  `make backup` → `docker exec loyalfamily node -e "require('better-sqlite3')('/data/loyalfamily.db').backup('/data/backup.db')"`
  Restore: stop the container, copy the backup over `loyalfamily.db`, delete stale
  `-wal`/`-shm`, start. Do the drill once before you need it.
- Resource target: comfortable on Raspberry Pi-class hardware (≤ 256 MB RAM).

## 8. Testable architecture

Module boundaries chosen so the risky logic is testable without browser/camera/network:

```
src/lib/domain/        pure TS, zero SvelteKit/Node imports → 100% unit-testable
  cards.ts             grid/tile building, visibility rule, search
  permissions.ts       canEdit/canDelete (owner + admin rules)
  validation.ts        input rules (uuid, color, EAN-13 checksum, symbology set)
  scanner.ts           symbology universe, brand→format hints, detector-name mapping
  import.ts            LoyalFamily JSON parser (text in → cards out)
  uuid.ts              id generation
src/lib/sync.ts        pure queue coalescing + replay (QueueStore/Transport injected)
src/lib/server/        server-only: repositories + pure (Request) → Response handlers
  bootstrap.ts         break-glass admin password reset (§6)
src/hooks.server.ts    server boot: applyAdminReset, SIGTERM → close SQLite
src/routes/api/        thin +server.ts wrappers: pass event.request to the handlers
```

There is no `src/lib/ports/` layer: the injectable seams that matter (queue store,
transport, detector) are plain function parameters in `sync.ts` and the scanner
component. Adding interfaces "for testability" here would be ceremony.

Tooling:

- **Vitest** unit tests (domain, parsers) + integration tests (API against
  in-memory SQLite via `better-sqlite3 :memory:`).
- **Playwright** e2e: the golden flows from REQUIREMENTS §11 (7 specs, run serially
  on one fresh server), incl. offline scenarios (`context.setOffline(true)`, server
  down) and PWA install/offline cold start, against the built app.
- **Barcode round-trip suite**: JsBarcode/qrcode render → `@zxing/library` (Node)
  decode → assert equality, one test per symbology incl. edge cases (short codes,
  checksum digits, non-ASCII in QR). This is also what exercises the ZXing decoder
  the browser fallback uses.
- Scanner: unit-tested as pure helpers (`scanner.ts`: detector-name mapping,
  unsupported-format rejection, brand-hint ordering) and e2e-tested through the real
  `getUserMedia` path with Chromium's fake camera and a stubbed detector.
  **No fixture photos of real cards, and no real-device run** — the ZXing-WASM
  fallback itself is verified by hand only (see §10).
- Migration tests: all migrations applied in order on a fresh DB, **and**
  `tests/fixtures/v0.1.db` (the released v0.1 schema, with a user and a card) run
  through `migrate()` to prove 002 upgrades a real database without losing rows.
  Each later release that changes the schema adds its own fixture DB.
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
11. ✅ Session revocation (`token_version`, migration 002) + break-glass admin reset
12. ✅ Sync invariants: full pull never discards unflushed local mutations; rejected
    ops are counted and shown instead of silently dropped

## 10. Not yet true (do not trust the ✅ above for these)

- **No real-device verification.** Wake lock, fullscreen, camera scanning and the
  ZXing-WASM fallback on Android Chrome / iOS Safari / Firefox are untested —
  headless Playwright has no camera. The manual hardware matrix (REQUIREMENTS §5a)
  has never been run.
- **Brand logos are monograms**, not the real SVG logos REQUIREMENTS §4 describes.
- **No scanner fixture photos**; the WASM decode path is only covered indirectly by
  the round-trip suite.
- **No published images**: `v0.1` is a git tag and CI builds every push, but no
  registry publishes `loyalfamily:<version>` — `make build` tags locally only, so the
  rollback story is real for a self-hoster who builds from source and unproven
  anywhere else.
- A 401 from the API does not yet bounce the client to the login page (§3).
- Read-only container rootfs: not implemented (§7).
