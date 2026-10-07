# LoyalFamily — Developer Guide

Everything runs in Docker. The host needs **only Docker** — no Node, no npm,
no native build tools. Local commands and CI run the *same* container targets.

---

## 1. The five commands you need

```bash
make test     # typecheck + lint + unit + integration tests (Docker target `test`)
make dev      # Vite dev server with hot reload at http://localhost:5173
make build    # build the production runtime image (loyalfamily:latest)
make run      # build + docker compose up (production shape, http://localhost:3000)
make lock     # regenerate package-lock.json (see §5 — uses --legacy-peer-deps on purpose)
```

`make test` is the gate: it runs `svelte-check` and the full Vitest suite
inside the container. If it's green, the repo is healthy.

## 2. Repository layout

```
src/
  lib/
    brands.ts              curated Belgian brand catalog (add brands here)
    types.ts               shared Card/User types
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
    stores/                client-side Svelte stores (cards/session)
    idb.ts                 IndexedDB mirror + mutation queue (offline)
    sync.ts                pure queue coalescing/flush (injectable transport)
    components/            Svelte components (CardForm, Scanner, BarcodeView, …)
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

## 5. Dependencies & the lockfile

- `make lock` regenerates `package-lock.json` with
  **`--legacy-peer-deps`**. This is deliberate: SvelteKit declares `vite` and
  `typescript` as *peer* deps, and npm's default peer auto-install would drag
  ~50 MB of build tools into the production image. Production runtime needs
  only: `@sveltejs/kit`, `svelte`, `better-sqlite3`, `@node-rs/argon2`.
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
`tests/integration/sync_offline.test.ts` (golden replay) together.

## 8. Docker targets

| Target | What it does |
|---|---|
| `deps` | full `npm ci` (dev + prod) — base for build/test/dev |
| `build` | `svelte-kit sync && vite build` (adapter-node output in `build/`) |
| `test` | `npm run check` + `vitest run` — this is `make test` |
| `prod-deps` | `npm ci --omit=dev --legacy-peer-deps` (~26 MB) |
| `runtime` | final image: prod deps + build output, non-root, `PORT=8080`, `DATA_DIR=/data`, healthcheck |

Debug a running production container:

```bash
docker exec -it <name> node -e "const db=require('better-sqlite3')('/data/loyalfamily.db');console.log(db.prepare('SELECT count(*) c FROM cards').get())"
```

## 9. Known gaps / next steps

- Playwright e2e golden flows (DESIGN §8) are not wired up yet (`make e2e`
  is a placeholder).
- Real-device testing on Android Chrome / iOS Safari (wake lock, fullscreen,
  scanner fallback degradations) is still manual.
- Brand logos are monograms; real SVG logos are a v2 polish item.
