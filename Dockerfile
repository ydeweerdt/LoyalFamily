# LoyalFamily — one multi-stage Dockerfile for dev, test and production.
# Local and CI run identical targets:  docker build --target test .

# Digest-pinned: a mutable tag could be republished under us. Dependabot bumps
# these (see .github/dependabot.yml).
FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS base
WORKDIR /app

# ---- deps: full install (incl. dev toolchain for build/test stages) ----
FROM base AS deps
# build tools only needed if a native prebuild is unavailable; never shipped
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the SvelteKit app (adapter-node) ----
FROM deps AS build
COPY . .
RUN npx svelte-kit sync && npx vite build

# ---- test: lint/typecheck + unit + integration (REQUIREMENTS §11) ----
FROM deps AS test
COPY . .
RUN npx svelte-kit sync \
 && npm run check \
 && npx vitest run

# ---- e2e: Playwright golden flows against the built production app ----
# Official Playwright image (browsers preinstalled; tag must match the
# @playwright/test version pinned in package.json).
FROM mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea AS e2e
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts here too: the Playwright image has no make/g++, and skipping the
# install scripts also skips Playwright's browser download (this image ships them).
RUN npm ci --ignore-scripts
COPY --from=build /app/build ./build
COPY playwright.config.ts ./
COPY tests ./tests

FROM e2e AS e2e-run
RUN npx playwright test

# ---- prod-deps: production-only node_modules ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
# --ignore-scripts: better-sqlite3 13 and @node-rs/argon2 ship the native binary
# inside the tarball (prebuilds/linuxmusl-*.node). Without this flag npm sees
# better-sqlite3's binding.gyp and runs node-gyp, which needs a compiler this
# stage deliberately does not have.
RUN npm ci --omit=dev --ignore-scripts

# ---- runtime: minimal shipped image ----
FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
RUN mkdir -p /data && chown -R app:app /data
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build  --chown=app:app /app/build          ./build
# the --ignore-scripts install above is only honest if the shipped binaries load:
# fail the build here, not the container on the customer's machine.
RUN node -e "require('better-sqlite3'); require('@node-rs/argon2')"
# The container only ever runs `node build/index.js`: npm (17 MB, with its own
# unfixed advisories in brace-expansion/pacote/picomatch/sigstore) is pure surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* \
         /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
USER app
EXPOSE 8080
VOLUME /data
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/api/health" >/dev/null || exit 1
CMD ["node", "build/index.js"]
