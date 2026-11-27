import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, db } from '$lib/server/db';
import { countUsers, createUser } from '$lib/server/users';
import { createSessionToken } from '$lib/server/sessions';
import { registerHandler as register } from '$lib/server/handlers';
import { createInviteHandler, joinHandler } from '$lib/server/admin_handlers';

function jsonReq(url: string, body: unknown): Request {
	return new Request(`http://localhost${url}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function usernames(): string[] {
	return (db().prepare('SELECT username FROM users').all() as { username: string }[]).map((u) => u.username);
}

beforeEach(() => resetDb(':memory:'));

describe('races (REQUIREMENTS §7: first admin is unique, invites are single-use)', () => {
	it('two simultaneous first-run registrations cannot both become admin', async () => {
		const res = await Promise.all([
			register(jsonReq('/api/register', { username: 'bob', display_name: 'Bob', password: 'password123' })),
			register(jsonReq('/api/register', { username: 'carol', display_name: 'Carol', password: 'password123' }))
		]);
		expect(res.map((r) => r.status).sort()).toEqual([201, 403]);
		expect(usernames().length).toBe(1);
	});

	it('one invite token yields one account even when two joins race', async () => {
		const admin = createUser({ username: 'root', displayName: 'Root', passwordHash: 'x', role: 'admin' }).id;
		const invite = await (
			await createInviteHandler(
				new Request('http://localhost/api/admin/invites', {
					method: 'POST',
					headers: { 'content-type': 'application/json', cookie: `session=${createSessionToken(admin, 0)}` }
				})
			)
		).json();

		const join = (u: string) =>
			joinHandler(jsonReq('/api/join', { token: invite.token, username: u, display_name: u, password: 'longenough1' }));
		const res = await Promise.all([join('bob'), join('carol')]);

		expect(res.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 400]);
		// the loser is rolled back completely: no orphan user, one redemption
		expect(usernames().filter((n) => n === 'bob' || n === 'carol').length).toBe(1);
		expect(countUsers()).toBe(2); // root + exactly one member
	});
});
