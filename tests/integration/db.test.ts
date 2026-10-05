import { describe, it, expect } from 'vitest';
import { migrate, openDb, closeDb } from '$lib/server/db';

describe('db & migrations', () => {
	it('creates all tables and records the migration', () => {
		const db = openDb(':memory:');
		const tables = db
			.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
			.all()
			.map((r) => (r as { name: string }).name);
		expect(tables).toContain('users');
		expect(tables).toContain('cards');
		expect(tables).toContain('invites');
		expect(tables).toContain('schema_versions');
		const versions = db.prepare('SELECT version, name FROM schema_versions').all();
		expect(versions).toEqual([{ version: 1, name: '001_init' }]);
		db.close();
	});

	it('migrations are idempotent (running twice changes nothing)', () => {
		const db = openDb(':memory:');
		migrate(db);
		migrate(db);
		const versions = db.prepare('SELECT COUNT(*) AS c FROM schema_versions').get() as { c: number };
		expect(versions.c).toBe(1);
		db.close();
	});

	it('card CHECK constraints reject invalid symbology/visibility', () => {
		const db = openDb(':memory:');
		db.prepare(
			`INSERT INTO users (id, username, display_name, password_hash, role, created_at)
			 VALUES ('u1','u','U','x','user','2026-01-01')`
		).run();
		const insert = db.prepare(
			`INSERT INTO cards (id, owner_id, name, color, barcode_value, symbology, visibility,
				created_at, updated_at, updated_by)
			 VALUES ('c1','u1','n','#000000','1','BOGUS','private','2026-01-01','2026-01-01','u1')`
		);
		expect(() => insert.run()).toThrow(/CHECK constraint/i);
		db.close();
	});
});
