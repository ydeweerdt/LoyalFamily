import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '$lib/server/db';
import { createUser, findByUsername, getUser } from '$lib/server/users';
import { createSessionToken } from '$lib/server/sessions';
import { createCardHandler, cardsListHandler } from '$lib/server/card_handlers';
import {
	adminResetPasswordHandler,
	changePasswordHandler,
	createInviteHandler,
	deleteUserHandler,
	invitesListHandler,
	joinHandler,
	revokeInviteHandler,
	setRoleHandler,
	usersListHandler
} from '$lib/server/admin_handlers';
import { createInvite, getInviteByToken } from '$lib/server/invites';
import { applyAdminReset } from '$lib/server/bootstrap';

let admin: string, alice: string;

beforeEach(() => {
	resetDb(':memory:');
	admin = createUser({ username: 'root', displayName: 'Root', passwordHash: 'x', role: 'admin' }).id;
	alice = createUser({ username: 'alice', displayName: 'Alice', passwordHash: 'x', role: 'user' }).id;
});

function req(userId: string | null, method: string, url: string, body?: unknown): Request {
	return new Request(`http://localhost${url}`, {
		method,
		headers: {
			'content-type': 'application/json',
			...(userId ? { cookie: `session=${createSessionToken(userId, getUser(userId)?.token_version ?? 0)}` } : {})
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

async function cookieOf(userId: string): Promise<string> {
	// minted against the user's CURRENT token_version; mint one before a bump to get a stale cookie
	return `session=${createSessionToken(userId, getUser(userId)?.token_version ?? 0)}`;
}

describe('invites (REQUIREMENTS §7: single-use, expiring, no email)', () => {
	it('admin creates an invite; non-admin and anonymous cannot', async () => {
		expect((await createInviteHandler(req(admin, 'POST', '/api/admin/invites'))).status).toBe(201);
		expect((await createInviteHandler(req(alice, 'POST', '/api/admin/invites'))).status).toBe(403);
		expect((await createInviteHandler(req(null, 'POST', '/api/admin/invites'))).status).toBe(401);
	});

	it('invite token is 128-bit hex and lands in the join URL flow', async () => {
		const res = await createInviteHandler(req(admin, 'POST', '/api/admin/invites'));
		const invite = await res.json();
		expect(invite.token).toMatch(/^[0-9a-f]{32}$/);
		expect(getInviteByToken(invite.token)).toBeDefined();
	});

	it('join with a valid invite creates a role=user member and logs them in', async () => {
		const invite = await (await createInviteHandler(req(admin, 'POST', '/api/admin/invites'))).json();
		const res = await joinHandler(
			req(null, 'POST', '/api/join', {
				token: invite.token,
				username: 'bob',
				display_name: 'Bob',
				password: 'hunter2hunter2'
			})
		);
		expect(res.status).toBe(201);
		const user = await res.json();
		expect(user.role).toBe('user'); // invitees never start as admin
		expect(res.headers.get('set-cookie')).toContain('session=');

		const users = (await (await usersListHandler(req(admin, 'GET', '/api/admin/users'))).json()).users;
		expect(users.map((u: { username: string }) => u.username)).toContain('bob');
	});

	it('invite is single-use; expired and unknown tokens are rejected', async () => {
		const invite = createInvite(admin);

		const ok = await joinHandler(
			req(null, 'POST', '/api/join', { token: invite.token, username: 'bob', display_name: 'Bob', password: 'longenough1' })
		);
		expect(ok.status).toBe(201);

		expect(
			(
				await joinHandler(
					req(null, 'POST', '/api/join', { token: invite.token, username: 'eve', display_name: 'Eve', password: 'longenough1' })
				)
			).status
		).toBe(400); // already used

		const expired = createInvite(admin);
		getInviteByToken(expired.token); // sanity
		// forge expiry into the past
		(await import('$lib/server/db')).db().prepare('UPDATE invites SET expires_at = ? WHERE token = ?').run('2020-01-01T00:00:00.000Z', expired.token);
		expect(
			(
				await joinHandler(
					req(null, 'POST', '/api/join', { token: expired.token, username: 'eve', display_name: 'Eve', password: 'longenough1' })
				)
			).status
		).toBe(400);

		expect(
			(
				await joinHandler(
					req(null, 'POST', '/api/join', { token: 'nope', username: 'eve', display_name: 'Eve', password: 'longenough1' })
				)
			).status
		).toBe(404);
	});

	it('join validates input and rejects taken usernames', async () => {
		const invite = createInvite(admin);
		expect(
			(await joinHandler(req(null, 'POST', '/api/join', { token: invite.token, username: 'AL', display_name: 'X', password: 'longenough1' })))
				.status
		).toBe(400);
		expect(
			(await joinHandler(req(null, 'POST', '/api/join', { token: invite.token, username: 'alice', display_name: 'X', password: 'longenough1' })))
				.status
		).toBe(409);
	});

	it('admin lists and revokes unused invites; used ones cannot be revoked', async () => {
		const i1 = createInvite(admin);
		const i2 = createInvite(admin);
		await joinHandler(req(null, 'POST', '/api/join', { token: i2.token, username: 'bob', display_name: 'Bob', password: 'longenough1' }));

		const list = (await (await invitesListHandler(req(admin, 'GET', '/api/admin/invites'))).json()).invites;
		expect(list.length).toBe(2);
		expect(list.find((i: { id: string }) => i.id === i2.id).used_at).not.toBeNull();

		expect((await revokeInviteHandler(req(admin, 'DELETE', `/api/admin/invites/${i1.id}`), i1.id)).status).toBe(200);
		expect((await revokeInviteHandler(req(admin, 'DELETE', `/api/admin/invites/${i2.id}`), i2.id)).status).toBe(404);
	});
});

describe('admin user management (REQUIREMENTS §7)', () => {
	it('only admins can manage users', async () => {
		expect((await usersListHandler(req(alice, 'GET', '/api/admin/users'))).status).toBe(403);
		expect((await usersListHandler(req(null, 'GET', '/api/admin/users'))).status).toBe(401);
	});

	it('promote and demote; the last admin can never be demoted or deleted', async () => {
		// promote alice → now two admins
		const res = await setRoleHandler(req(admin, 'PUT', `/api/admin/users/${alice}`, { role: 'admin' }), alice);
		expect(res.status).toBe(200);
		expect((await res.json()).role).toBe('admin');

		// demote alice is fine now
		expect((await setRoleHandler(req(admin, 'PUT', `/api/admin/users/${alice}`, { role: 'user' }), alice)).status).toBe(200);

		// demoting the only remaining admin → blocked
		expect((await setRoleHandler(req(admin, 'PUT', `/api/admin/users/${admin}`, { role: 'user' }), admin)).status).toBe(400);
		// deleting the only remaining admin → blocked
		expect((await deleteUserHandler(req(admin, 'DELETE', `/api/admin/users/${admin}`), admin)).status).toBe(400);
	});

	it('admin cannot delete their own account; can delete others', async () => {
		expect((await deleteUserHandler(req(admin, 'DELETE', `/api/admin/users/${admin}`), admin)).status).toBe(400);
		expect((await deleteUserHandler(req(admin, 'DELETE', `/api/admin/users/${alice}`), alice)).status).toBe(200);
		expect(getUser(alice)).toBeUndefined();
	});

	it('deleting a user cascades all their cards — private and shared alike', async () => {
		const own = { id: crypto.randomUUID(), brand_id: 'delhaize', name: 'Delhaize', color: '#e30613', barcode_value: '4501234567890', symbology: 'EAN_13', visibility: 'private' };
		const shared = { id: crypto.randomUUID(), brand_id: 'lidl', name: 'Lidl Plus', color: '#0050aa', barcode_value: '9501234567895', symbology: 'EAN_13', visibility: 'shared' };
		await createCardHandler(req(alice, 'POST', '/api/cards', own));
		await createCardHandler(req(alice, 'POST', '/api/cards', shared));

		// visible to admin while alice exists (the shared one)
		expect((await (await cardsListHandler(req(admin, 'GET', '/api/cards'))).json()).cards.length).toBe(1);

		expect((await deleteUserHandler(req(admin, 'DELETE', `/api/admin/users/${alice}`), alice)).status).toBe(200);

		// REQUIREMENTS §7: user removal cascades to their cards — all of them
		expect((await (await cardsListHandler(req(admin, 'GET', '/api/cards'))).json()).cards).toHaveLength(0);
	});

	it('admin can reset any password; old one stops working, new one logs in', async () => {
		const { verifyPassword } = await import('$lib/server/users');
		expect((await adminResetPasswordHandler(req(alice, 'PUT', `/api/admin/users/${alice}/password`, { password: 'nope12345' }), alice)).status).toBe(403);
		expect((await adminResetPasswordHandler(req(admin, 'PUT', `/api/admin/users/${alice}/password`, { password: 'short' }), alice)).status).toBe(400);
		expect((await adminResetPasswordHandler(req(admin, 'PUT', `/api/admin/users/${alice}/password`, { password: 'brandnew123' }), alice)).status).toBe(200);

		const stored = findByUsername('alice')!;
		expect(await verifyPassword(stored.password_hash, 'brandnew123')).toBe(true);
		expect(await verifyPassword(stored.password_hash, 'x')).toBe(false);
	});
});

describe('self-service password change', () => {
	it('requires the correct current password', async () => {
		const { setPasswordHash } = await import('$lib/server/users');
		const { hashPassword } = await import('$lib/server/users');
		await setPasswordHash(alice, await hashPassword('oldpassword1'));

		expect(
			(await changePasswordHandler(
				new Request('http://localhost/api/me/password', {
					method: 'PUT',
					headers: { 'content-type': 'application/json', cookie: await cookieOf(alice) },
					body: JSON.stringify({ current_password: 'wrong', new_password: 'newpassword1' })
				})
			)).status
		).toBe(403);

		expect(
			(
				await changePasswordHandler(
					new Request('http://localhost/api/me/password', {
						method: 'PUT',
						headers: { 'content-type': 'application/json', cookie: await cookieOf(alice) },
						body: JSON.stringify({ current_password: 'oldpassword1', new_password: 'short' })
					})
				)
			).status
		).toBe(400);

		const res = await changePasswordHandler(
			new Request('http://localhost/api/me/password', {
				method: 'PUT',
				headers: { 'content-type': 'application/json', cookie: await cookieOf(alice) },
				body: JSON.stringify({ current_password: 'oldpassword1', new_password: 'newpassword1' })
			})
		);
		expect(res.status).toBe(200);
	});
});

describe('session revocation (REQUIREMENTS §7: remove/demote/password-reset ends sessions)', () => {
	const as = (cookie: string) => cardsListHandler(new Request('http://localhost/api/cards', { headers: { cookie } }));

	it('admin password reset invalidates cookies issued before it', async () => {
		const cookie = await cookieOf(alice);
		expect((await as(cookie)).status).toBe(200);
		expect((await adminResetPasswordHandler(req(admin, 'PUT', `/api/admin/users/${alice}/password`, { password: 'brandnew123' }), alice)).status).toBe(200);
		expect((await as(cookie)).status).toBe(401);
	});

	it('role changes invalidate the affected user\'s cookies', async () => {
		const adminCookie = await cookieOf(admin);
		const aliceCookie = await cookieOf(alice);
		expect((await as(aliceCookie)).status).toBe(200);

		expect((await setRoleHandler(req(admin, 'PUT', `/api/admin/users/${alice}`, { role: 'admin' }), alice)).status).toBe(200);
		expect((await as(aliceCookie)).status).toBe(401); // promoted → logged out everywhere

		expect((await setRoleHandler(req(admin, 'PUT', `/api/admin/users/${admin}`, { role: 'user' }), admin)).status).toBe(200);
		expect((await as(adminCookie)).status).toBe(401); // demoted → logged out everywhere
	});

	it('deleting a user invalidates their cookie', async () => {
		const cookie = await cookieOf(alice);
		expect((await as(cookie)).status).toBe(200);
		expect((await deleteUserHandler(req(admin, 'DELETE', `/api/admin/users/${alice}`), alice)).status).toBe(200);
		expect((await as(cookie)).status).toBe(401);
	});

	it('changing your own password keeps this device signed in and kills the old cookie', async () => {
		const { hashPassword, setPasswordHash } = await import('$lib/server/users');
		await setPasswordHash(alice, await hashPassword('oldpassword1'));
		const oldCookie = await cookieOf(alice);

		const res = await changePasswordHandler(
			new Request('http://localhost/api/me/password', {
				method: 'PUT',
				headers: { cookie: oldCookie, 'content-type': 'application/json' },
				body: JSON.stringify({ current_password: 'oldpassword1', new_password: 'newpassword1' })
			})
		);
		expect(res.status).toBe(200);

		const newCookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
		expect(newCookie).toMatch(/^session=.+\./);
		expect((await as(oldCookie)).status).toBe(401);
		expect((await as(newCookie)).status).toBe(200);
	});
});

describe('break-glass admin reset (REQUIREMENTS §7: no email recovery exists)', () => {
	it('RESET_ADMIN + RESET_ADMIN_PASSWORD resets that user\'s password at startup', async () => {
		process.env.RESET_ADMIN = 'alice';
		process.env.RESET_ADMIN_PASSWORD = 'recovered123';
		try {
			applyAdminReset();
			const { verifyPassword } = await import('$lib/server/users');
			expect(await verifyPassword(findByUsername('alice')!.password_hash, 'recovered123')).toBe(true);

			process.env.RESET_ADMIN = 'ghost'; // unknown username → no-op, no crash
			applyAdminReset();
			expect(findByUsername('alice')).toBeDefined();
			expect(await verifyPassword(findByUsername('alice')!.password_hash, 'recovered123')).toBe(true);
		} finally {
			delete process.env.RESET_ADMIN;
			delete process.env.RESET_ADMIN_PASSWORD;
		}
	});
});
