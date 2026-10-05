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

# ---- prod-deps: production-only node_modules ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: minimal shipped image ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
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
