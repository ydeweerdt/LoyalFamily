# LoyalFamily — Developer Guide

Everything runs in Docker. The host needs **only Docker** — no Node, no npm,
no native build tools. Local commands and CI run the *same* container targets.

---

## 1. The five commands you need

```bash
make test     # typecheck + lint + unit + integration tests (Docker target `test`)
make e2e      # Playwright golden flows against the built production app
make dev      # Vite dev server with hot reload at http://localhost:5173
make build    # build the production runtime image (loyalfamily:<git-describe> + :latest)
make run      # build + docker compose up (production shape, http://localhost:3000)
make backup   # hot SQLite backup inside the running container (UserGuide §5)
make lock     # regenerate package-lock.json (see §5 — runs npm 11 in node:24-alpine)
```

`make test` is the gate: it runs `svelte-check` and the full Vitest suite
inside the container. If it's green, the repo is healthy.

## 2. Repository layout

```
src/
  lib/
    brands.ts              curated Belgian brand catalog (add brands here)
    types.ts               shared Card/User types
    i18n.svelte.ts         en/nl strings + browser-language auto-detect
    domain/                PURE TS — no SvelteKit/Node imports (100% unit-testable)
      cards.ts             grid/tile logic, visibility rule, search filter
      validation.ts        pure input rules (uuid, color, EAN-13 checksum, …)
      permissions.ts       owner/admin edit/delete rules
      scanner.ts           symbology mapping/hints for the scanner
      import.ts            LoyalFamily JSON parser (text in → cards out)
    server/                server-only code
      db.ts                better-sqlite3 singleton + migrations + resetDb (tests)
      migrations/          SQL, applied in order at startup
      users.ts cards.ts invites.ts sessions.ts   repositories
      handlers.ts card_handlers.ts admin_handlers.ts   pure (Request) → Response
      bootstrap.ts         break-glass admin password reset (RESET_ADMIN env)
    stores/                client-side Svelte stores (cards/session)
    idb.ts                 IndexedDB mirror + mutation queue (offline)
    sync.ts                pure queue coalescing/flush (injectable transport)
    components/            Svelte components (CardForm, Scanner, BarcodeView, …)
  hooks.server.ts          server boot: applyAdminReset + SIGTERM → close SQLite
  routes/                  SvelteKit routes; api/** are thin +server.ts wrappers
static/
  sw.js manifest.json icons/   PWA shell (deliberately NOT caching /api/**)
tests/
  unit/                    pure domain/parsers/sync logic
  integration/             real handlers against in-memory SQLite
  fixtures/                import fixtures (loyalfamily-json-v1)
```

## 3. Architecture rules (keep these)

1. **Pure domain layer.** All business logic lives in `src/lib/domain/` as
   plain TS functions — no SvelteKit, no `node:` imports. If it can't be
   unit-tested without a server, it doesn't belong there.
2. **Handlers are plain `(Request, params) => Response`.** `+server.ts` files
   are 5-line wrappers that pass `event.request`. Tests import the pure
   handlers directly and call them with `new Request(...)` — no HTTP server
   in tests.
3. **Client talks through the store, never raw `fetch`.** `src/lib/stores/cards.ts`
   is the single source of truth: optimistic update → enqueue → send →
   full-pull reconcile.
4. **Server enforces permissions too.** Client-side checks are UX; the real
   rules are re-checked in handlers (`canEdit`/`canDelete`).
5. **Card ids are client-generated UUIDs.** Server validates the shape;
   collisions never abort (import mints fresh ids).
6. **Sessions are revocable via `users.token_version`.** The signed cookie carries
   it and `sessionUser()` re-checks it on every request. Anything that must kill a
   session (password change, role change) bumps it in the same UPDATE; deleting the
   user row kills it too. Never mint a token without the user's current version:
   `createSessionToken(user.id, user.token_version)`.

## 4. Running tests

### Full suite (the default)

```bash
make test
```

Runs, inside one container: `svelte-check` (typecheck) → `vitest run`
(13 files, unit + integration).

### A single test file / watch mode

Build the deps image once, then mount your working tree into it:

```bash
docker build --target deps -t loyalfamily-deps .

docker run --rm -v "$PWD":/app -w /app loyalfamily-deps npx vitest run tests/unit/import.test.ts
docker run --rm -v "$PWD":/app -w /app loyalfamily-deps npx vitest watch
docker run --rm -v "$PWD":/app -w /app loyalfamily-deps npm run check   # typecheck only
```

Test env (`DATA_DIR=:memory:`, a fixed `COOKIE_SECRET`) is preconfigured in
`vite.config.ts` — integration tests call `resetDb(':memory:')` in
`beforeEach`, so every test gets a clean database.

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs exactly the same two builds
you run locally: `docker build --target test` and the runtime image build.
There is no separate CI toolchain to keep in sync.

### E2E golden flows (`make e2e`)

Playwright drives the **built production app** (adapter-node server on a
throwaway DB) through the four golden flows from DESIGN §8:

```
tests/e2e/01-setup.spec.ts    empty server → first admin → invite → join → single-use link
          02-card.spec.ts     brand picker → manual entry → tile → full-screen barcode
                              (+ fake camera → scan path → add form)
          03-offline.spec.ts  offline add → queued → reconnect → server truth
          04-sharing.spec.ts  shared vs private across two users (UI + API + 403)
          05-pwa.spec.ts      manifest/icons served, SW controls page, offline cold launch
          06-server-down.spec.ts server unreachable → app shell + cached cards still work
          07-i18n.spec.ts     language auto-detect + Settings override
```

Notes for writing e2e specs here:

- The specs tell **one continuous story** on one fresh server (`workers: 1`,
  serial). Running a single later spec alone fails by design — the user it
  logs in as is created in `01`.
- The webServer in `playwright.config.ts` wipes `/tmp/loyalfamily-e2e-data` on
  start, so every `make e2e` begins with an empty database.
- No camera in headless: card entry is manual (the scanner path is covered
  by unit tests + real devices).
- Fast iteration without a full rebuild — mount just the specs onto the
  prebuilt base stage (run `make e2e` once first to build it):
  ```bash
  docker build --target e2e -t loyalfamily-e2e-base .
  docker run --rm -v "$PWD/tests/e2e:/app/tests/e2e" \
    -v "$PWD/playwright.config.ts:/app/playwright.config.ts" \
    loyalfamily-e2e-base npx playwright test
  ```
  (rebuild `e2e-base` whenever **app** code changes; the mounted specs are
  always current)
- The Playwright Docker image tag (`mcr.microsoft.com/playwright:vX-noble`)
  must match the pinned `@playwright/test` version in `package.json`.

## 5. Dependencies & the lockfile

- `make lock` regenerates `package-lock.json` inside **node:24-alpine** (npm 11).
  Deliberate: npm 11 records every optional platform package in the lock, and the
  npm in the e2e image (npm 11) rejects a lock written by npm 10 as out-of-sync.
  Peer deps resolve cleanly now (kit 3 + vite 8), so no `--legacy-peer-deps`.
- Build-time-only libraries (`vite`, `adapter-node`, `zxing`, `jsbarcode`,
  `qrcode`, …) belong in **devDependencies** — they are bundled into the
  client at build time and must not appear in the runtime image.
- After changing dependencies, run `make lock`, then `make test`, and check
  the runtime image size didn't jump (`docker images loyalfamily:latest`).

## 6. Development workflow

```bash
make dev        # http://localhost:5173 — hot reload on save
```

The dev server runs in-container with your source bind-mounted; `node_modules`
lives in a named volume (`loyalfamily-dev-modules`), so the host tree stays clean
and installs are cached. The dev server uses a throwaway SQLite file
(`DATA_DIR=/tmp/dev-data`) inside the container layer — it is discarded on
every `make dev`; the host tree never gets a `data/` directory.

To try the *production shape* locally: `make run` (compose, port 3000).

### Verifying the PWA/offline path locally

1. `make run`, open `http://localhost:3000`, register the first (admin) account.
2. DevTools → Application → Service Workers → confirm `sw.js` is activated.
3. DevTools → Network → “Offline” → the home grid still renders from
   IndexedDB; add/edit a card → banner shows queued changes.
4. Go back online → the queue flushes and a full pull reconciles.

Golden flows worth exercising by hand after any sync/scanner change:
first-admin setup → add card by scan → offline edit → reconnect sync →
invite → join → shared card visible on the other account.

## 7. Common tasks

**Add a brand:** append to `src/lib/brands.ts` (`id`, `name`, `color`,
optional `symbology_hint`). Catalog curation is UX, not correctness — the
“Unknown” path already handles everything else.

**Add an API endpoint:** pure handler in `src/lib/server/` → thin
`+server.ts` wrapper using `event.request` → integration test calling the
handler directly.

**Change the schema:** add a new file to `src/lib/server/migrations/`
(never edit applied ones); `resetDb` in tests applies all migrations.

**Touch the sync protocol:** `src/lib/sync.ts` is pure with an injectable
queue/transport — extend `tests/unit/sync.test.ts` and
`tests/integration/sync_offline.test.ts` (golden replay) together. Two rules are
load-bearing (REQUIREMENTS §6): a full pull never replaces a card that still has a
queued op, and a 4xx-dropped op is always counted in the store's `failed` so the
UI reports it.

## 8. Docker targets

| Target | What it does |
|---|---|
| `deps` | full `npm ci` (dev + prod) — base for build/test/dev |
| `build` | `svelte-kit sync && vite build` (adapter-node output in `build/`) |
| `test` | `npm run check` + `vitest run` — this is `make test` |
| `prod-deps` | `npm ci --omit=dev` (~26 MB) |
| `e2e` / `e2e-run` | Playwright image + built app + golden flows (`make e2e`) |
| `runtime` | final image: prod deps + build output, non-root, `PORT=8080`, `DATA_DIR=/data`, healthcheck |

Debug a running production container:

```bash
docker exec -it <name> node -e "const db=require('better-sqlite3')('/data/loyalfamily.db');console.log(db.prepare('SELECT count(*) c FROM cards').get())"
```

## 9. Known gaps / next steps

- Real-device testing on Android Chrome / iOS Safari (wake lock, fullscreen,
  scanner fallback degradations) is still manual — and it is the **only** proof of
  "scannable at the checkout" (manual matrix in REQUIREMENTS §5a).
- Brand logos are monograms; real SVG logos are a v2 polish item.
- No migration fixture DBs yet: they start being committed with the first release
  that changes the schema.
- A 401 from the API does not yet bounce the client to the login page — it shows
  the offline banner instead.
- Read-only container rootfs is documented as v2 hardening, not current behavior.
