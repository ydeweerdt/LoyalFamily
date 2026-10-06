import crypto from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { db } from './db';
import type { PublicUser, User } from '$lib/types';

// OWASP argon2id parameters
const ARGON2_OPTIONS = {
	memoryCost: 19456,
	timeCost: 2,
	outputLength: 32,
	parallelism: 1
};

export async function hashPassword(password: string): Promise<string> {
	return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashStr: string, password: string): Promise<boolean> {
	return verify(hashStr, password);
}

export function countUsers(): number {
	return (db().prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
}

export function createUser(input: {
	username: string;
	displayName: string;
	passwordHash: string;
	role: 'admin' | 'user';
}): PublicUser {
	const now = new Date().toISOString();
	const user: PublicUser = {
		id: crypto.randomUUID(),
		username: input.username,
		display_name: input.displayName,
		role: input.role
	};
	db()
		.prepare(
			'INSERT INTO users (id, username, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.run(user.id, user.username, user.display_name, input.passwordHash, user.role, now);
	return user;
}

export function findByUsername(username: string): User | undefined {
	return db().prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
}

export function getUser(id: string): User | undefined {
	return db().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function toPublicUser(user: User): PublicUser {
	return {
		id: user.id,
		username: user.username,
		display_name: user.display_name,
		role: user.role
	};
}

export function countAdmins(): number {
	return (db().prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`).get() as { c: number }).c;
}

export function listUsers(): User[] {
	return db().prepare('SELECT * FROM users ORDER BY created_at ASC').all() as User[];
}

export function setUserRole(id: string, role: 'admin' | 'user'): void {
	db().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
}

export function setPasswordHash(id: string, passwordHash: string): void {
	db().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
}

/**
 * Remove a user and everything hanging off them (REQUIREMENTS §7:
 * user removal cascades to their cards). Cards they edited but do not own
 * (shared cards) keep an audit trail by re-attributing updated_by to the
 * acting admin.
 */
export function deleteUser(id: string, actingAdminId: string): void {
	db().transaction(() => {
		db()
			.prepare('DELETE FROM cards WHERE owner_id = ?')
			.run(id);
		db()
			.prepare('UPDATE cards SET updated_by = ? WHERE updated_by = ?')
			.run(actingAdminId, id);
		db()
			.prepare('DELETE FROM invites WHERE created_by = ? OR used_by = ?')
			.run(id, id);
		db().prepare('DELETE FROM users WHERE id = ?').run(id);
	})();
}
