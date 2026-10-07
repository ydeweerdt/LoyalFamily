# Everything runs in containers — the host needs only Docker (REQUIREMENTS §10).
.PHONY: lock test e2e build run dev

lock:
	docker run --rm -v $(CURDIR):/app -w /app node:22-alpine npm install --package-lock-only --legacy-peer-deps

test:
	docker build --target test -t loyalfamily-test .

e2e:
	docker build --target e2e-run -t loyalfamily-e2e .

build:
	docker build -t loyalfamily:latest .

run: build
	docker compose up --build

# Vite dev server with hot reload, fully in-container:
# source is bind-mounted; node_modules lives in a named volume so the
# host tree stays clean and installs stay cached.
dev:
	docker build --target deps -t loyalfamily-deps .
	docker volume create loyalfamily-dev-modules >/dev/null
	docker run --rm -p 5173:5173 -v $(CURDIR):/app -v loyalfamily-dev-modules:/app/node_modules \
		-e DATA_DIR=/tmp/dev-data -e COOKIE_SECRET=dev-secret-00000000000000000000000000 \
		-w /app loyalfamily-deps npm run dev -- --host 0.0.0.0
