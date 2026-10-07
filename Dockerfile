# LoyalFamily — one multi-stage Dockerfile for dev, test and production.
# Local and CI run identical targets:  docker build --target test .

FROM node:22-alpine AS base
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
FROM mcr.microsoft.com/playwright:v1.54.1-noble AS e2e
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY --from=build /app/build ./build
COPY playwright.config.ts ./
COPY tests ./tests

FROM e2e AS e2e-run
RUN npx playwright test

# ---- prod-deps: production-only node_modules ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
# --legacy-peer-deps: kit's vite/typescript peers are build-time only; the
# built server needs kit's regular deps + svelte + native modules, nothing else.
RUN npm ci --omit=dev --legacy-peer-deps

# ---- runtime: minimal shipped image ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
RUN mkdir -p /data && chown -R app:app /data
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build  --chown=app:app /app/build          ./build
USER app
EXPOSE 8080
VOLUME /data
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/api/health" >/dev/null || exit 1
CMD ["node", "build/index.js"]
