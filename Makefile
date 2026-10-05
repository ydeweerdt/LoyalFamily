# Everything runs in containers — the host needs only Docker (REQUIREMENTS §10).
.PHONY: lock test e2e build run dev

lock:
	docker run --rm -v $(CURDIR):/app -w /app node:22-alpine npm install --package-lock-only

test:
	docker build --target test -t loyalfamily-test .

e2e:
	@echo "e2e stage arrives with milestone 6 (Playwright)"

build:
	docker build -t loyalfamily:latest .

run: build
	docker compose up --build
