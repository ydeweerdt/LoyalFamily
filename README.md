title: LoyalFamily - PWA to replace Stocard

Self-hosted loyalty-card wallet: a SvelteKit PWA + small Node/SQLite server in one
Docker container, for one family.

## Status

v0.1 — the feature set in `REQUIREMENTS.md` is implemented and guarded by 14 unit
+ integration test files and 7 Playwright golden flows, all runnable in Docker.

**Not yet verified on real phones**: camera scanning, wake lock, fullscreen barcode
display and the iOS/Firefox scanner fallback. Treat "scannable at the checkout" as
unproven until the manual hardware matrix (REQUIREMENTS §5a) has been run once.

## Quick start

```bash
make run          # build + docker compose up → http://localhost:3000
make test         # typecheck + unit + integration tests (in Docker)
make e2e          # Playwright golden flows against the built app
```

First visit to an empty server: register → you become the administrator → invite
family members from the Admin screen.

## Goals

* Fast
* Can be installed as a PWA
* Loyalty cards need to be cached on the device to make them available when offline
* It must be possible to add new cards preferably by a built in barcode/qr code scanner when online
* When a new loyalty card is added on one device it must be synched to other devices when these devices open the PWA.
* 1 server instance means 1 family, if a card is added; it is either private to the current user or shared to all users
* Users can only join the server upon invitation by the administrator
* When starting the server for the very first time the first user can register itself as administrator
* An administrator can invite other people to join
* An administrator can change the type of account of other people to administrator or regular user

## What this is not

* Not a multi-tenant SaaS: one container = one family (≤ ~10 users, ≤ ~100 cards).
* Not a gift-card / ticket / coupon wallet.
* Not affiliated with, or endorsed by, Stocard or Klarna. "Stocard" is used here
  only to describe what this app replaces; see `LICENSE`.

## Before you expose it

This server stores your family's loyalty card numbers in plaintext, and those
numbers work like credentials at the checkout. Put it behind a reverse proxy with
TLS (or a Tailscale/Cloudflare tunnel), set `PUBLIC_URL` to the real https URL, and
keep the data volume to yourself. Details: `REQUIREMENTS.md` §9, `UserGuide.md`.

## Docs

- `REQUIREMENTS.md` — what we build (decisions closed; §14 lists what is not)
- `DESIGN.md` — how we build it (schema, API, sync, Docker, milestones, §10 "not yet true")
- `UserGuide.md` — build, run, deploy, back up, admin duties
- `DeveloperGuide.md` — dev environment, tests, architecture rules
- `Roadmap.md` — v2 candidates, not commitments
