import { applyAdminReset } from '$lib/server/bootstrap';
import { closeDb } from '$lib/server/db';

// kit 2 GHSA-pfhg-q3qv-9q6r (fixed only in kit 3): a `//host/...` path is treated
// as an absolute redirect target by enhanced form submissions. Never let one in.
export function handle({ event, resolve }) {
	if (event.url.pathname.startsWith('//')) return new Response(null, { status: 400 });
	return resolve(event);
}

// Runs once at server boot (adapter-node): break-glass admin password reset.
applyAdminReset();

// Graceful shutdown (REQUIREMENTS §10): closing SQLite checkpoints the WAL, so the
// DB file left in the volume is complete and safe to copy.
process.on('SIGTERM', () => {
	closeDb();
	process.exit(0);
});
