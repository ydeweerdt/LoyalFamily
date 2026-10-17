# Everything runs in containers — the host needs only Docker (REQUIREMENTS §10).
.PHONY: lock test e2e build run dev backup

# rollback story (REQUIREMENTS §10): every build is tagged by version, :latest too
VERSION := $(shell git describe --tags --always 2>/dev/null || echo dev)

lock:
	docker run --rm -v $(CURDIR):/app -w /app node:22-alpine npm install --package-lock-only --legacy-peer-deps

test:
	docker build --target test -t loyalfamily-test .

e2e:
	docker build --target e2e-run -t loyalfamily-e2e .

build:
	docker build -t loyalfamily:$(VERSION) -t loyalfamily:latest .

run: build
	docker compose up --build

# Safe hot backup: SQLite's own backup API, no downtime, consistent even while
# data still sits in the -wal file. Restore: stop, copy backup.db over loyalfamily.db,
# delete stale -wal/-shm, start (UserGuide).
backup:
	docker exec loyalfamily node -e "require('better-sqlite3')('/data/loyalfamily.db').backup('/data/backup-'+new Date().toISOString().slice(0,10)+'.db')"

# Vite dev server with hot reload, fully in-container:
# source is bind-mounted; node_modules lives in a named volume so the
# host tree stays clean and installs stay cached.
dev:
	docker build --target deps -t loyalfamily-deps .
	docker volume create loyalfamily-dev-modules >/dev/null
	docker run --rm -p 5173:5173 -v $(CURDIR):/app -v loyalfamily-dev-modules:/app/node_modules \
		-e DATA_DIR=/tmp/dev-data -e COOKIE_SECRET=dev-secret-00000000000000000000000000 \
		-w /app loyalfamily-deps npm run dev -- --host 0.0.0.0
