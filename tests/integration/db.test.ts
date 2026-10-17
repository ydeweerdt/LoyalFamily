import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
		expect(versions).toEqual([
			{ version: 1, name: '001_init' },
			{ version: 2, name: '002_token_version' }
		]);
		db.close();
	});

	it('002 adds token_version on top of the 001 schema', () => {
		const db = openDb(':memory:');
		const cols = db.prepare('PRAGMA table_info(users)').all().map((r) => (r as { name: string }).name);
		expect(cols).toContain('token_version');
		db.close();
	});

	it('migrations are idempotent (running twice changes nothing)', () => {
		const db = openDb(':memory:');
		migrate(db);
		migrate(db);
		const versions = db.prepare('SELECT COUNT(*) AS c FROM schema_versions').get() as { c: number };
		expect(versions.c).toBe(2);
		db.close();
	});

	it('migrates a released v0.1 database in place, keeping its rows', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loyalfamily-migrate-'));
		fs.copyFileSync('tests/fixtures/v0.1.db', path.join(dir, 'loyalfamily.db'));
		const db = openDb(dir);
		const users = db.prepare('SELECT * FROM users').all() as { token_version: number }[];
		const cards = db.prepare('SELECT id, name FROM cards').all() as { id: string; name: string }[];
		expect(users).toHaveLength(1);
		expect(users[0].token_version).toBe(0); // existing users get the default
		expect(cards.map((c) => c.name)).toEqual(['Colruyt card']);
		expect((db.prepare('SELECT COUNT(*) AS c FROM schema_versions').get() as { c: number }).c).toBe(2);
		db.close();
		fs.rmSync(dir, { recursive: true, force: true });
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
