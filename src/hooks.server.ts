import { applyAdminReset } from '$lib/server/bootstrap';
import { closeDb } from '$lib/server/db';

// Runs once at server boot (adapter-node): break-glass admin password reset.
applyAdminReset();

// Graceful shutdown (REQUIREMENTS §10): closing SQLite checkpoints the WAL, so the
// DB file left in the volume is complete and safe to copy.
process.on('SIGTERM', () => {
	closeDb();
	process.exit(0);
});
