import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb } from '$lib/server/db';
import { createUser } from '$lib/server/users';
import { createSessionToken } from '$lib/server/sessions';
import {
	createCardHandler,
	cardsListHandler,
	deleteCardHandler,
	updateCardHandler
} from '$lib/server/card_handlers';

let alice: string, bob: string, admin: string;

beforeEach(() => {
	resetDb(':memory:');
	alice = createUser({ username: 'alice', displayName: 'Alice', passwordHash: 'x', role: 'user' }).id;
	bob = createUser({ username: 'bob', displayName: 'Bob', passwordHash: 'x', role: 'user' }).id;
	admin = createUser({ username: 'root', displayName: 'Root', passwordHash: 'x', role: 'admin' }).id;
});

function asReq(userId: string, method: string, url: string, body?: unknown): Request {
	return new Request(`http://localhost${url}`, {
		method,
		headers: {
			'content-type': 'application/json',
			cookie: `session=${createSessionToken(userId, 0)}`
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

function newCard(overrides: Record<string, unknown> = {}) {
	return {
		id: crypto.randomUUID(),
		brand_id: 'delhaize',
		name: 'Delhaize',
		color: '#e30613',
		barcode_value: '4501234567890',
		symbology: 'EAN_13',
		visibility: 'private',
		comment: null,
		...overrides
	};
}

async function listAs(userId: string) {
	const res = await cardsListHandler(asReq(userId, 'GET', '/api/cards'));
	return (await res.json()).cards as { id: string }[];
}

describe('card CRUD + permissions (REQUIREMENTS §7)', () => {
	it('create → owner sees it; others do not (private default)', async () => {
		const card = newCard();
		const res = await createCardHandler(asReq(alice, 'POST', '/api/cards', card));
		expect(res.status).toBe(201);

		expect((await listAs(alice)).map((c) => c.id)).toContain(card.id);
		expect((await listAs(bob)).map((c) => c.id)).not.toContain(card.id);
		expect((await listAs(admin)).map((c) => c.id)).not.toContain(card.id);
	});

	it('shared card is visible to everyone', async () => {
		const card = newCard({ visibility: 'shared' });
		await createCardHandler(asReq(alice, 'POST', '/api/cards', card));
		expect((await listAs(bob)).map((c) => c.id)).toContain(card.id);
		expect((await listAs(admin)).map((c) => c.id)).toContain(card.id);
	});

	it('rejects invalid payloads', async () => {
		expect((await createCardHandler(asReq(alice, 'POST', '/api/cards', newCard({ id: 'not-a-uuid' }))))
			.status).toBe(400);
		expect((await createCardHandler(asReq(alice, 'POST', '/api/cards', newCard({ symbology: 'AZTEC' }))))
			.status).toBe(400);
		expect((await createCardHandler(asReq(alice, 'POST', '/api/cards', newCard({ color: 'red' }))))
			.status).toBe(400);
		expect((await createCardHandler(asReq(alice, 'POST', '/api/cards', newCard({ barcode_value: '' }))))
			.status).toBe(400);
		expect((await createCardHandler(asReq(alice, 'POST', '/api/cards', newCard({ brand_id: 'nosuchbrand' }))))
			.status).toBe(400);
	});

	it('duplicate id → 409', async () => {
		const card = newCard();
		await createCardHandler(asReq(alice, 'POST', '/api/cards', card));
		const again = await createCardHandler(asReq(bob, 'POST', '/api/cards', card));
		expect(again.status).toBe(409);
	});

	it('owner can edit and toggle visibility; others and admin cannot', async () => {
		const card = newCard();
		await createCardHandler(asReq(alice, 'POST', '/api/cards', card));

		expect((await updateCardHandler(asReq(bob, 'PUT', `/api/cards/${card.id}`, { name: 'hacked' }), card.id))
			.status).toBe(403);
		expect((await updateCardHandler(asReq(admin, 'PUT', `/api/cards/${card.id}`, { name: 'hacked' }), card.id))
			.status).toBe(403);

		const res = await updateCardHandler(asReq(alice, 'PUT', `/api/cards/${card.id}`, { visibility: 'shared' }), card.id);
		expect(res.status).toBe(200);
		expect((await res.json()).visibility).toBe('shared');
		expect((await listAs(bob)).map((c) => c.id)).toContain(card.id); // shared → visible now
	});

	it('delete: owner yes, non-owner no, admin override yes', async () => {
		const card = newCard({ visibility: 'shared' });
		await createCardHandler(asReq(alice, 'POST', '/api/cards', card));

		expect((await deleteCardHandler(asReq(bob, 'DELETE', `/api/cards/${card.id}`), card.id)).status).toBe(403);

		expect((await deleteCardHandler(asReq(admin, 'DELETE', `/api/cards/${card.id}`), card.id)).status).toBe(200);
		expect((await listAs(alice)).map((c) => c.id)).not.toContain(card.id); // tombstone excluded
	});

	it('unauthenticated requests are rejected on every verb', async () => {
		const anon = (url: string, method: string) => new Request(`http://localhost${url}`, { method });
		expect((await cardsListHandler(anon('/api/cards', 'GET'))).status).toBe(401);
		expect((await createCardHandler(anon('/api/cards', 'POST'))).status).toBe(401);
		expect((await updateCardHandler(anon('/api/cards/x', 'PUT'), 'x')).status).toBe(401);
		expect((await deleteCardHandler(anon('/api/cards/x', 'DELETE'), 'x')).status).toBe(401);
	});
});
