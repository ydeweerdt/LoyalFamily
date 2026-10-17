# LoyalFamily — Requirements

Vision: see [README.md](README.md). This document refines it into concrete requirements.

## 1. Scope

- **Loyalty / membership cards only.** No gift cards, tickets, or coupons.
- Target region: **Belgium** (Belgian store/brand catalog first).
- One server instance = one family. Small scale by design: ≤ ~10 users, ≤ ~100 cards.
  Optimize for simplicity, not scale.

## 2. Main UI (modeled on SuperCards)

- Home screen: **grid of brand tiles, 3 columns × 7 rows** (21 tiles), each tile =
  a brand (brand logo on brand-colored background). Continuous scrolling beyond 21.
- **One tile per brand** (option 1): multiple cards of the same brand (e.g. a
  private and a shared Delhaize card) open a **per-brand card list** showing each
  card with its comment, owner and visibility; tapping one shows its barcode.
- Tile badges:
  - count badge (`2`, …) when ≥ 2 cards of that brand are visible to the current user
  - 🔒 badge when the brand has **one of your own private cards**; in the per-brand
    list each card shows its own visibility/lock state
- **Private = invisible.** Private cards of other users are not shown at all —
  no tiles, no badges, no counts for them. A user only ever sees: their own cards
  (private or shared) + shared cards of others.
- Top menu bar with a **`+` button** to add a card.
- `+` opens a **brand picker**: grid of known store/brand logos with a **search bar**
  to filter by name.
- Selecting a brand immediately opens the **barcode/QR scanner**.
- Brand picker always offers **"Unknown"** as last option → free-text name + color
  swatch picker.
- After a successful scan: show a **card info confirmation form** with the rendered
  barcode preview, the detected value/symbology, a **"shared" checkbox (default:
  private)** and an optional **comment** field. Save adds it to the grid.
  - Comment is how users disambiguate multiple cards of the same brand
    (e.g. a private Delhaize card and a shared family Delhaize card).
    The grid shows brand logo; the card detail view lists all cards of that brand
    with their comments.
- Tapping a tile that holds a single card shows the barcode/QR **full-screen,
  max-contrast white rendering**, ready to scan at the checkout. Must work fully
  offline.
  Note: browsers cannot change OS screen brightness. We do the best possible:
  fullscreen mode + Screen Wake Lock (where supported) + mostly-white rendering,
  which triggers adaptive brightness on most phones; one-time hint toast telling
  the user to raise brightness.
- Long-press on a tile: single-card tile → edit dialog (owner only); stacked
  tile → opens the same tile view. In the tile view: tap a card tile → barcode,
  long-press → edit dialog (delete lives in the edit dialog).
  Edit (owner only) covers: barcode value, symbology, color, comment, visibility.
  Brand `name` is fixed for catalog brands; free-text editable only for "Unknown"
  cards. Delete: owner, or admin (any card).

## 2a. Platforms & installability

- Must be an **installable PWA** (manifest, icons, standalone display, add-to-
  home-screen) on: **Android Chrome/Edge/Firefox, iOS Safari ≥ 16.4, desktop
  Chrome/Firefox/Edge**.
- iOS Safari and Firefox lack `BarcodeDetector` → the WASM scanner fallback and
  the fullscreen/wake-lock degradations must be exercised on these platforms.

## 2b. Languages

- UI strings in **English and Dutch**. The app auto-detects the browser language
  (Dutch when it starts with `nl`, English otherwise) with a manual override in
  Settings: `auto` / `nl` / `en`.
- Brand names, comments and barcode values are user data — never translated.

## 3. Card data model

| Field | Notes |
|---|---|
| `name` | brand name, or free text for "Unknown" |
| `brandId` | reference into curated brand catalog, or null |
| `color` | brand color (from catalog) or user-picked |
| `barcodeValue` | the decoded string; editable by owner |
| `symbology` | EAN_13, UPC_A, CODE_128, CODE_39, QR (+ AZTEC/DATA_MATRIX/PDF_417 later); editable by owner |
| `visibility` | `private` (owner only) or `shared` (whole family); owner can toggle |
| `comment` | optional free text; disambiguates multiple cards of the same brand |
| `ownerId` | the user who added the card; ownership is fixed |
| `createdAt`, `updatedAt`, `updatedBy` | sync (last-write-wins) + last-change audit (no history table in v1) |

No card images required in v1 (barcodes are rendered from data). Optional photo
attachment is a v2 candidate.

## 4. Brand catalog

- Small **curated catalog of Belgian brands** shipped as static data with the app:
  ~30–50 brands (Colruyt/Bonus, Delhaize, Carrefour, Albert Heijn, Kruidvat,
  Dietsaver, Decathlon, MediaMarkt, Lidl Plus, IKEA Family, Coolblue, Bol, …).
- Each entry: name, SVG logo, brand color, optional default symbology hint
  (e.g. Delhaize → CODE_128) used to prioritize the scanner decoder.
- Catalog is **curation for UX, not correctness**: "Unknown" covers everything else.
- Out of scope: SuperCards-style 4,000-template database, per-store instructions,
  AI-assisted scanning.

## 5. Scanning & rendering

- **Render** (checkout): EAN-13, UPC-A, CODE_128, CODE_39 via a JS barcode renderer;
  QR via a QR renderer. Rendered offline from stored data, fast (< ~200 ms to display).
- **Scan** (add card): camera-based. Use `BarcodeDetector` when available; fall back
  to a WASM decoder (ZXing-js or similar) for iOS Safari / Firefox.
  The **detection set equals the render set** in v1; scans of other symbologies are
  rejected with a clear message pointing to manual entry.
- Manual entry fallback (type number + pick symbology) when camera can't read the card.
- Scanning may work **offline**: card is stored locally and queued for sync.

## 5a. Barcode value rules (what "correct" means)

- The stored value is **exactly the decoded payload**: never numeric-converted,
  never trimmed. Leading zeros are data — `0123456789012` stays 13 characters.
- **One canonical symbology per physical barcode.** EAN-13 and UPC-A are the same
  symbol family: a 13-digit scan is stored as `EAN_13`, a 12-digit scan as
  `UPC_A`. The symbology picker preselects what the scanner reported; the user
  only overrides it on manual entry.
- **Shape is validated when the card is saved**, not when it is opened: a value the
  symbology cannot encode at all is refused by the form (reason shown inline) and by
  the API — EAN-13 = 13 digits, UPC-A = 12 digits, CODE_39 = `0-9`, uppercase `A-Z`
  and `- . $ / + %` space, CODE_128 = printable ASCII, QR = any printable text.
  Editing only the value or only the symbology is checked against the pair the card
  would end up with.
- Checksums are **warned about, never blocked** where the symbology has one
  (EAN-13): some loyalty cards use non-standard check digits, and the owner knows
  better than the app. The warning is shown while typing and again on the card view.
- Values are printable text, 1–512 chars. QR values are stored as-is (byte mode),
  no escaping or re-encoding.
- A value that cannot be rendered in its symbology — imported or pre-existing data,
  since new saves are rejected — falls back to the raw number + symbology name: a
  readable number at the checkout beats a broken barcode.
- **Acceptance gate:** "scannable at the checkout" is verified by the round-trip
  suite (§11) *and* by a manual matrix — supported symbology × phone (Android
  Chrome, iOS Safari) × a real store scanner — before every release. No unit test
  replaces the hardware pass.

## 6. Sync & offline

- Server is the source of truth; PWA caches **all visible cards** locally
  (IndexedDB + Service Worker; precache app shell, logos, fonts).
- Sync strategy v1: **full pull + push on mutation**.
  - **Pull**: on app open and after any successful push, the server returns the
    **complete set of live cards visible to that user** (tombstones stay
    server-side — a full replacement makes them unnecessary on the client); the
    client replaces its cache. At ≤ 100 cards a full pull is cheaper than delta
    logic and eliminates stale-cache bugs (e.g. a card switched shared→private must
    vanish from other devices; a `?since=` delta would not deliver it).
  - **Push**: mutations applied optimistically, enqueued, retried when online.
    Last-write-wins via server-assigned `updatedAt`. No WebSockets/CRDTs.
- Hard requirement: viewing and displaying cached cards works with **zero network**.

### Invariants (the sync model is only correct if these hold)

1. The server is the source of truth; the client cache is derived and always
   replaceable — **except** for a card that still has an unflushed local mutation:
   a full pull must never discard a local change that the server has not seen yet.
2. Every mutation is queued before it is sent; nothing is sent that is not queued.
3. A rejected mutation (4xx) must never be silent: the change is dropped, the UI
   reverts to server truth, and the offline banner says **"N changes could not be
   saved"**.

### Accepted risks (deliberate, because of family scale)

- **Same user, two devices, both offline, same card edited** → last push wins.
  No merge, no conflict UI, no warning to the losing device.
- **Offline edit of a card deleted server-side** (or of a card owned by a removed
  user) → the op is rejected (404), dropped, and the edit is lost — with the
  banner from invariant 3.
- **Retry policy**: network failure or 5xx → the op stays queued and is retried on
  every sync trigger. No backoff, no max attempts, no dead-letter state.
- **Tombstones are never purged.** `deleted_at` rows accumulate forever (user
  removals hard-delete instead). Harmless at ≤ 100 cards; do not "fix" this unless
  the scale assumption changes.

## 7. Auth & roles

- First registered user on an empty server becomes **administrator**
  (guarded: only while user table is empty).
- Users join **only via invitation**: single-use, expiring invite link (no email
  infrastructure required; admin copies the link to the person).
- Admin can: promote/demote users, remove users, delete any card, set a new
  password for any user (no email infrastructure exists → no self-service reset).
- **At least one admin must always exist**: the last admin cannot be demoted or
  removed.
- **Removing a user removes all cards they own** (private and shared) — cards are
  tied to their owner and cannot be reassigned in v1. Other devices converge on
  the next full pull.
- Users change their own password while logged in.
- Visibility default is **private**; sharing is an explicit choice (checkbox at
  creation, toggle later).
- **Only the owner** (the user who added the card) can toggle a card between
  private and shared. No one else — not even the admin — changes a card's visibility.
- Regular users: see their own cards (private or shared) + shared cards of others.
- **Editing and deleting a card is owner-only** — including its comment, name and
  barcode value. Shared cards are read-only for everyone except their owner.
  Admin may delete any card as a last-resort cleanup action.
- Passwords hashed (argon2id). Session cookie (HttpOnly, Secure).
- **Sessions are revocable.** A session is a signed 30-day cookie carrying the
  user's `token_version`; the server re-checks it on every request. Removing a
  user, resetting their password, or changing their role bumps that version, so
  **every session issued before it stops working immediately** — a removed family
  member does not keep access until the cookie expires.
- Changing your **own** password logs the other devices out and re-issues the
  cookie on the device you changed it from.
- **Break-glass for the unrecoverable case**: no email + "the last admin can never
  be removed" means a lost admin password would lock the family out of its own
  data. Setting `RESET_ADMIN=<username>` + `RESET_ADMIN_PASSWORD=…` in the
  container environment resets that user's password once at startup (and revokes
  their sessions). Documented in UserGuide; it is the only recovery path.
- **CSRF**: no token. Mutations are same-origin JSON POST/PUT/DELETE and the
  session cookie is `SameSite=Lax`, which browsers refuse to send on cross-site
  writes. This is a decision, not an omission — revisit if a non-browser client
  (CLI, other app) ever gets write access.

## 8. Import / export

- **Import a LoyalFamily export file** (`loyalfamily-json-v1`) — adoption/migration
  path: export on the old instance, import here. Export and import use the same
  format, so every backup is re-importable.
- Import/export a simple JSON format (also usable as backup; single-file backup story).
- Import creates cards **owned by the importer**, private by default, and never
  overwrites existing cards: re-importing the same file duplicates cards. Accepted
  in v1 (import is a one-shot adoption step, not a continuous sync).
- Export is per-user ("what is visible to me"). There is no whole-family export in
  v1 — the family-wide backup is the SQLite file (§10).

## 9. Security

- Card numbers are effectively credentials: HTTPS only, no card data in URLs/logs.
- Not a public multi-tenant SaaS: single-family instance, expected to sit behind a
  home reverse proxy (Caddy/Traefik), optionally Tailscale/Cloudflare Tunnel.
- **The volume is the sensitive asset.** Card values are stored in plaintext —
  encrypt the disk/SD card, keep backups out of unencrypted cloud storage, and do
  not share the volume.
- Session cookie over HTTPS uses the `__Host-session` prefix (Secure + Path=/ +
  no Domain); over plain HTTP it is a plain `session` cookie without `Secure`,
  which is why `PUBLIC_URL` must be set to the real https URL.
- **Rate limiting is not implemented in the app** — it is delegated to the reverse
  proxy in front of it (Caddy `rate_limited` / Tailscale ACLs). A family instance
  behind a tunnel is not a brute-force target; a port-forwarded one is.
- No CSRF token by design (see §7).

## 10. Deployment (Docker)

- The server **must be deployable as a single Docker container**:
  - one published image (multi-stage build, small runtime based on Node LTS),
    tagged by version; no other runtime dependencies
  - **stateless image**: all persistent state (SQLite DB + WAL) lives in a
    single volume mounted at `DATA_DIR` (default `/data`)
  - configuration **only via environment variables**: `PORT`, `DATA_DIR`,
    `COOKIE_SECRET`, `PUBLIC_URL`, `TZ` (+ `RESET_ADMIN`/`RESET_ADMIN_PASSWORD`
    for the §7 break-glass, set only for one start)
  - ship a ready-to-use `docker-compose.yaml` example (port mapping + volume) in
    the repo
  - TLS termination is **out of scope for the container** — handled by the reverse
    proxy in front of it. The app does **not** read `X-Forwarded-Proto`; it decides
    cookie `Secure` from `PUBLIC_URL`, so `PUBLIC_URL` must be the real public URL
  - healthcheck endpoint (`/api/health`) for compose/orchestrator
  - graceful shutdown on SIGTERM: SQLite is closed, which checkpoints the WAL so
    the DB file left behind is complete
  - **exactly one container instance may hold the volume** — SQLite/WAL has no
    multi-process writers. Never run two containers (or a second stack) on the same
    volume, and never put `DATA_DIR` on NFS/CIFS/NAS-mounted storage: use local
    block storage.
  - **backup story**: a hot copy of `loyalfamily.db` is *not* safe while the app runs
    (committed data can still sit in the `-wal` file). Use SQLite's own backup:
    `docker exec <c> node -e "require('better-sqlite3')('/data/loyalfamily.db').backup('/data/backup.db')"`
    — no downtime, consistent snapshot. Restore = stop the container, copy the
    backup over `loyalfamily.db` (+ remove stale `-wal`/`-shm`), start. Documented in
    UserGuide with a restore drill.
  - schema migrations run automatically at container start
  - must run comfortably on a Raspberry Pi-class machine (≤ 256 MB RAM)
- **Everything runs in containers — the host needs only Docker:**
  - building, unit/integration/e2e testing, linting and typechecking all execute
    in Docker stages/targets; no Node/npm toolchain on the host, ever
  - the same multi-stage Dockerfile defines: `base → deps → build → test → runtime`
    stages; local dev/test and CI invoke the **same stage targets**
    (e.g. `docker build --target test .`), so "works on my machine" == "works in CI"
  - a thin `Makefile` wraps the common ones: `make test`, `make e2e`, `make build`,
    `make run`, `make backup`
- **Minimal final image:**
  - final stage contains only: Node runtime + compiled app + production deps
    (no source, no dev dependencies, no build toolchain, no npm cache)
  - target: `node:<LTS>-alpine` runtime; app layer (node_modules + build) ≤ ~40 MB;
    the node:22-alpine base dominates the uncompressed size and is deliberately
    kept boring
  - native modules (better-sqlite3) compiled in a build stage; final stage copies
    only the compiled artifact
  - runs as non-root user. A read-only rootfs (writable only `DATA_DIR`) is a
    **v2 hardening**, not current behavior — do not assume it in docs or compose.

## 11. Testing & regression safety

- **Critical flows must be automated** (they guard every future maintenance change):
  1. register-first-admin → login → add card (manual entry path) → barcode renders
  2. permissions: non-owner cannot edit/delete/visibility-toggle a card
  3. sync: offline mutation → reconnect → correct state on both devices
  4. import a LoyalFamily export → cards appear with correct symbology
- **Barcode round-trip test**: for every supported symbology, render the barcode
  from data and decode it back with an independent decoder → must equal the input.
  This is the single best regression guard for the core promise ("scannable at the
  checkout").
- Scanner logic must be testable **without a camera**: the detector is injectable,
  and the decoder is exercised on rasterized renders by the round-trip suite. There
  are no fixture photos of real cards; the WASM fallback on real devices is covered
  only by the manual matrix in §5a.
- API layer tested against a real (in-memory) SQLite, not a mock — schema and
  migration regressions must be caught.
- **Migrations are tested**: every migration runs from the previous released
  schema in CI. `tests/fixtures/v0.1.db` (committed, one user + one card) is the
  released v0.1 schema; `002_token_version` is verified against it. Every future
  release that changes the schema gets its own fixture DB.
- Offline behavior tested with network disabled in the browser (e2e).
- CI on every push: typecheck, lint, unit + integration + e2e, Docker build —
  **all executed inside containers** (same stage targets as local), so the host
  requires nothing but Docker. A release = green CI + version-tagged image;
  rollback = run the previous tag.
- No test-only hooks in production code: testability comes from the module
  boundaries defined in DESIGN.md (pure domain logic, injectable ports).

### Guard map (requirement → what protects it)

| Requirement | Guard |
|---|---|
| §7 first user = admin, invite-only join, single-use invites | `tests/e2e/01-setup.spec.ts`, `tests/integration/auth.test.ts`, `admin.test.ts` |
| §7 owner-only edit/delete/visibility, admin delete override | `tests/integration/cards.test.ts`, `tests/e2e/04-sharing.spec.ts` |
| §7 last admin cannot be demoted/removed | `tests/integration/admin.test.ts` |
| §7 sessions are revocable (remove/demote/password reset) | `tests/integration/admin.test.ts` (session revocation) |
| §7 break-glass admin reset | `tests/integration/admin.test.ts` (bootstrap) |
| §2 grid/tiles/badges | `tests/unit/grid.test.ts` |
| §5a barcode value rules + "scannable at the checkout" | `tests/unit/barcode.test.ts` (round-trip per symbology) + manual hardware matrix |
| §5 scanner without a camera | `tests/unit/scanner.test.ts`, `tests/unit/import.test.ts` |
| §6 offline mutation → reconnect → correct state | `tests/integration/sync_offline.test.ts`, `tests/e2e/03-offline.spec.ts` |
| §6 offline cold start (zero network) | `tests/e2e/05-pwa.spec.ts`, `tests/e2e/06-server-down.spec.ts` |
| §6 rejected mutation is never silent | `tests/unit/sync.test.ts`, `tests/integration/sync_offline.test.ts` (`dropped` count) |
| §8 LoyalFamily import/export | `tests/unit/import.test.ts`, `tests/integration/import_export.test.ts` |
| §2b languages | `tests/unit/i18n.test.ts`, `tests/e2e/07-i18n.spec.ts` |

## 12. Non-goals (v1)

- Gift cards / tickets / coupons.
- Multi-server / public SaaS / open registration.
- Card images, receipts, points balance tracking.
- Wearables, widgets, native apps.

## 13. Decided

1. **Stack**: single **SvelteKit** app (adapter-node) serving both the PWA frontend
   and the JSON API, **better-sqlite3** for storage, TypeScript end-to-end.
   Deployed as one Docker container (see §10); backup = copy the SQLite file.
   Barcode rendering: JsBarcode (1D) + qrcode (QR); scanning: `BarcodeDetector`
   with a WASM ZXing fallback for browsers lacking it.
2. **Offline scanning**: allowed — cards scanned offline are stored locally and
   queued for sync when connectivity returns.
3. **Permissions**: comments, editing, deleting and visibility toggling are
   owner-only. Admin retains a delete-any-card override as cleanup escape hatch.
4. Private cards are fully invisible to other users; 🔒 only marks the owner's
   own private cards.
5. **Invites**: single-use link, valid 7 days.
6. **Grid overflow**: continuous scrolling (no paging).
7. **Tile ordering**: automatic, alphabetical by brand name ("Unknown" cards sort
   by their free-text name).
8. **Sync**: full pull (no delta) — see §6.
9. **Card IDs**: client-generated UUIDs, so offline-created cards keep one stable
   ID across client and server.
10. **User removal**: cascades to their cards; last admin cannot be removed/demoted.
11. **Passwords**: self-change while logged in; admin can reset any user's password;
    no email-based recovery — instead a documented `RESET_ADMIN` break-glass (§7).
12. **Sessions**: signed 30-day cookie, revocable per user via `token_version`
    (§7). No server-side session table.
13. **No CSRF token** (SameSite=Lax is the defense) and **no in-app rate limiting**
    (delegated to the reverse proxy) — §7, §9.
14. **Localization**: English + Dutch, browser auto-detect with a Settings override
    (§2b). Other languages are v2 candidates.
15. **Import never merges**: it only adds cards owned by the importer (§8).

## 14. Open questions (not decided — do not implement before deciding)

- **Uploaded logo for "Unknown" brands** (Roadmap): if added, the image must live
  as a BLOB in SQLite, not as a file in the volume — otherwise "backup = one file"
  (§10) silently loses it. Size limit and where it is cached offline are undecided.
- **Real logos for catalog brands** (Roadmap): currently monograms. Trademark
  handling for brand logos is undecided.
- **Whole-family export** (admin): currently only per-user export + the DB file.
  Needed if a family wants to migrate to a new server without a raw file copy.
- **Card photo attachment** (v2 candidate in §3): same storage question as logos.
- **More languages** (fr/de) once a third language exists: the i18n file is a flat
  key map and will need a different shape.
