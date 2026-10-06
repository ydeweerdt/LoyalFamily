import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrations } from './migrations/index';

/**
 * Open (and migrate) the application database.
 * DATA_DIR === ':memory:' selects an in-memory DB (used by integration tests).
 */
export function openDb(location = process.env.DATA_DIR ?? 'data'): Database.Database {
	const inMemory = location === ':memory:';
	if (!inMemory) fs.mkdirSync(location, { recursive: true });
	const db = new Database(inMemory ? ':memory:' : path.join(location, 'loyalfamily.db'));
	db.pragma('foreign_keys = ON');
	if (!inMemory) db.pragma('journal_mode = WAL');
	migrate(db);
	return db;
}

export function migrate(db: Database.Database): void {
	db.exec(
		`CREATE TABLE IF NOT EXISTS schema_versions (
			version INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			applied_at TEXT NOT NULL
		)`
	);
	const done = new Set(
		db.prepare('SELECT version FROM schema_versions').all().map((r) => (r as { version: number }).version)
	);
	for (const m of migrations) {
		if (done.has(m.version)) continue;
		db.transaction(() => {
			db.exec(m.sql);
			db.prepare('INSERT INTO schema_versions (version, name, applied_at) VALUES (?, ?, ?)').run(
				m.version,
				m.name,
				new Date().toISOString()
			);
		})();
	}
}

let _db: Database.Database | undefined;

/** Lazily opened application DB singleton (per process). */
export function db(): Database.Database {
	if (!_db) _db = openDb();
	return _db;
}

/** Replace the singleton with a fresh DB (used by integration tests). */
export function resetDb(location = ':memory:'): Database.Database {
	closeDb();
	_db = openDb(location);
	return _db;
}

export function closeDb(): void {
	_db?.close();
	_db = undefined;
}
