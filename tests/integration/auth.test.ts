import { describe, it, expect } from 'vitest';

// in-memory DB + fixed secret for the whole file (db is opened lazily on first request)
process.env.DATA_DIR = ':memory:';
process.env.COOKIE_SECRET = 'test-secret-0000000000000000000000000000';

import { registerHandler as register, loginHandler as login, meHandler as me, cardsHandler as cards } from '$lib/server/handlers';
import { GET as health } from '../../src/routes/api/health/+server';

function req(url: string, init?: RequestInit): Request {
	return new Request(`http://localhost${url}`, init);
}

function jsonReq(url: string, body: unknown): Request {
	return req(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function cookieOf(res: Response): string {
	const sc = res.headers.get('set-cookie') ?? '';
	return sc.split(';')[0];
}

describe('auth API (critical flow 1: register-first-admin → login → me)', () => {
	let sessionCookie = '';

	it('health is public', async () => {
		const res = await health();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: 'ok' });
	});

	it('rejects invalid input while registration is still open', async () => {
		const res = await register(jsonReq('/api/register', { username: 'B', display_name: '', password: 'short' }));
		expect(res.status).toBe(400);
	});

	it('first registration succeeds and becomes admin', async () => {
		const res = await register(jsonReq('/api/register', { username: 'alice', display_name: 'Alice', password: 'wonderwall1' }));
		expect(res.status).toBe(201);
		const user = await res.json();
		expect(user).toMatchObject({ username: 'alice', role: 'admin' });
		sessionCookie = cookieOf(res);
		expect(sessionCookie).toMatch(/^session=.+\./);
	});

	it('registration is closed once a user exists', async () => {
		const res = await register(jsonReq('/api/register', { username: 'bob', display_name: 'Bob', password: 'password123' }));
		expect(res.status).toBe(403);
	});

	it('me returns the session user', async () => {
		const res = await me(req('/api/me', { headers: { cookie: sessionCookie } }));
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ username: 'alice', role: 'admin' });
	});

	it('me without a cookie is 401', async () => {
		const res = await me(req('/api/me'));
		expect(res.status).toBe(401);
	});

	it('me with a tampered cookie is 401', async () => {
		const res = await me(req('/api/me', { headers: { cookie: 'session=abc.tampered' } }));
		expect(res.status).toBe(401);
	});

	it('login with wrong password gives a generic error (no user enumeration)', async () => {
		const res = await login(jsonReq('/api/login', { username: 'alice', password: 'wrong-password' }));
		expect(res.status).toBe(401);
		expect((await res.json()).error).toBe('invalid username or password');
	});

	it('login works and issues a session cookie', async () => {
		const res = await login(jsonReq('/api/login', { username: 'alice', password: 'wonderwall1' }));
		expect(res.status).toBe(200);
		expect(cookieOf(res)).toMatch(/^session=.+\./);
	});

	it('cards requires auth', async () => {
		const res = await cards(req('/api/cards'));
		expect(res.status).toBe(401);
	});
});
