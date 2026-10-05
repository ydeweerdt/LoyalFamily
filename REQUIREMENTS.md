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
- Long-press / menu on a tile: card actions — view, edit, delete.
  Edit (owner only) covers: barcode value, symbology, color, comment, visibility.
  Brand `name` is fixed for catalog brands; free-text editable only for "Unknown"
  cards. Delete: owner, or admin (any card).

## 2a. Platforms & installability

- Must be an **installable PWA** (manifest, icons, standalone display, add-to-
  home-screen) on: **Android Chrome/Edge/Firefox, iOS Safari ≥ 16.4, desktop
  Chrome/Firefox/Edge**.
- iOS Safari and Firefox lack `BarcodeDetector` → the WASM scanner fallback and
  the fullscreen/wake-lock degradations must be exercised on these platforms.

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
| `createdAt`, `updatedAt`, `updatedBy` | sync (last-write-wins) + audit |

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

## 6. Sync & offline

- Server is the source of truth; PWA caches **all visible cards** locally
  (IndexedDB + Service Worker; precache app shell, logos, fonts).
- Sync strategy v1: **full pull + push on mutation**.
  - **Pull**: on app open and after any successful push, the server returns the
    **complete set of cards visible to that user** (incl. tombstones); the client
    replaces its cache. At ≤ 100 cards a full pull is cheaper than delta logic and
    eliminates stale-cache bugs (e.g. a card switched shared→private must vanish
    from other devices; a `?since=` delta would not deliver it).
  - **Push**: mutations applied optimistically, enqueued, retried when online.
    Last-write-wins via server-assigned `updatedAt`. No WebSockets/CRDTs.
- Hard requirement: viewing and displaying cached cards works with **zero network**.

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

## 8. Import / export

- **Import a LoyalFamily export file** (`loyalfamily-json-v1`) — adoption/migration
  path: export on the old instance, import here. Export and import use the same
  format, so every backup is re-importable.
- Import/export a simple JSON format (also usable as backup; single-file backup story).

## 9. Security

- Card numbers are effectively credentials: HTTPS only, no card data in URLs/logs.
- Not a public multi-tenant SaaS: single-family instance, expected to sit behind a
  home reverse proxy (Caddy/Traefik), optionally Tailscale/Cloudflare Tunnel.

## 10. Deployment (Docker)

- The server **must be deployable as a single Docker container**:
  - one published image (multi-stage build, small runtime based on Node LTS),
    tagged by version; no other runtime dependencies
  - **stateless image**: all persistent state (SQLite DB + WAL) lives in a
    single volume mounted at `DATA_DIR` (default `/data`)
  - configuration **only via environment variables**: `PORT`, `DATA_DIR`,
    `COOKIE_SECRET`, `PUBLIC_URL`, `TZ`
  - ship a ready-to-use `docker-compose.yaml` example (port mapping + volume) in
    the repo
  - TLS termination is **out of scope for the container** — handled by the
    reverse proxy in front of it; the app trusts `X-Forwarded-Proto`
  - healthcheck endpoint (`/api/health`) for compose/orchestrator
  - graceful shutdown on SIGTERM (flush WAL so the DB file stays copyable)
  - **backup story**: stop service (or rely on WAL) → copy `loyalfamily.db` from the
    volume; restore = copy back. Documented one-liner.
  - schema migrations run automatically at container start
  - must run comfortably on a Raspberry Pi-class machine (≤ 256 MB RAM)
- **Everything runs in containers — the host needs only Docker:**
  - building, unit/integration/e2e testing, linting and typechecking all execute
    in Docker stages/targets; no Node/npm toolchain on the host, ever
  - the same multi-stage Dockerfile defines: `base → deps → build → test → runtime`
    stages; local dev/test and CI invoke the **same stage targets**
    (e.g. `docker build --target test .`), so "works on my machine" == "works in CI"
  - a thin `Makefile` wraps the common ones: `make test`, `make e2e`, `make build`,
    `make run`
- **Minimal final image:**
  - final stage contains only: Node runtime + compiled app + production deps
    (no source, no dev dependencies, no build toolchain, no npm cache)
  - target: `node:<LTS>-alpine` or distroless runtime; image ≤ ~150 MB
  - native modules (better-sqlite3) compiled in a build stage; final stage copies
    only the compiled artifact
  - runs as non-root user; read-only filesystem except `DATA_DIR`

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
- Scanner logic must be testable **without a camera**: the scanner is an interface
  (detector injectable); decoder fallback tested against fixture images.
- API layer tested against a real (in-memory) SQLite, not a mock — schema and
  migration regressions must be caught.
- **Migrations are tested**: every migration runs from the previous released
  schema in CI; a fixture DB per release version is kept in the repo.
- Offline behavior tested with network disabled in the browser (e2e).
- CI on every push: typecheck, lint, unit + integration + e2e, Docker build —
  **all executed inside containers** (same stage targets as local), so the host
  requires nothing but Docker. A release = green CI + version-tagged image;
  rollback = run the previous tag.
- No test-only hooks in production code: testability comes from the module
  boundaries defined in DESIGN.md (pure domain logic, injectable ports).

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
    no email-based recovery.
