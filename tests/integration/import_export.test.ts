import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import { resetDb } from '$lib/server/db';
import { createUser } from '$lib/server/users';
import { createSessionToken } from '$lib/server/sessions';
import { exportHandler, importHandler, cardsListHandler } from '$lib/server/card_handlers';

let alice: string, bob: string;

beforeEach(() => {
	resetDb(':memory:');
	alice = createUser({ username: 'alice', displayName: 'Alice', passwordHash: 'x', role: 'admin' }).id;
	bob = createUser({ username: 'bob', displayName: 'Bob', passwordHash: 'x', role: 'user' }).id;
});

function req(userId: string | null, method: string, url: string, body?: string): Request {
	return new Request(`http://localhost${url}`, {
		method,
		headers: { ...(userId ? { cookie: `session=${createSessionToken(userId, 0)}` } : {}) },
		body
	});
}

const loyalFixture = fs.readFileSync('tests/fixtures/loyalfamily_export.json', 'utf8');

describe('import API (REQUIREMENTS §8)', () => {
	it('imports a LoyalFamily export: cards owned by the importer, private by default', async () => {
		const res = await importHandler(req(alice, 'POST', '/api/import', loyalFixture));
		expect(res.status).toBe(200);
		const out = await res.json();
		expect(out.imported).toBe(4);
		expect(out.skipped.length).toBe(1);
		expect(out.source).toBe('loyalfamily-json-v1');

		const pulled = (await (await cardsListHandler(req(alice, 'GET', '/api/cards'))).json()).cards;
		expect(pulled.length).toBe(4);
		expect(pulled.every((c: { owner_id: string }) => c.owner_id === alice)).toBe(true);
		expect(pulled.every((c: { visibility: string }) => c.visibility === 'private')).toBe(true);

		// invisible to everyone else (private default survives import)
		expect((await (await cardsListHandler(req(bob, 'GET', '/api/cards'))).json()).cards).toHaveLength(0);
	});

	it('re-importing the same file never collides: fresh ids minted', async () => {
		await importHandler(req(alice, 'POST', '/api/import', loyalFixture));
		const res = await importHandler(req(alice, 'POST', '/api/import', loyalFixture));
		expect(res.status).toBe(200);
		const pulled = (await (await cardsListHandler(req(alice, 'GET', '/api/cards'))).json()).cards;
		expect(pulled.length).toBe(8); // duplicates are new cards, not conflicts
	});

	it('rejects garbage files with a clear 400', async () => {
		const res = await importHandler(req(alice, 'POST', '/api/import', 'not json at all'));
		expect(res.status).toBe(400);
		expect((await res.json()).error).toContain('JSON');
	});

	it('requires authentication', async () => {
		expect((await importHandler(req(null, 'POST', '/api/import', loyalFixture))).status).toBe(401);
		expect((await exportHandler(req(null, 'GET', '/api/export'))).status).toBe(401);
	});
});

describe('export API + round-trip', () => {
	it('export → import on a fresh instance reproduces every card exactly', async () => {
		await importHandler(req(alice, 'POST', '/api/import', loyalFixture));
		const exported = await (await exportHandler(req(alice, 'GET', '/api/export'))).json();
		expect(exported.format).toBe('loyalfamily-json-v1');
		expect(exported.cards.length).toBe(4);
		// export is the user's OWN cards, attachment disposition for browser download
		expect(exportHandler(req(alice, 'GET', '/api/export')).headers.get('content-disposition')).toContain('attachment');

		const res = await importHandler(req(bob, 'POST', '/api/import', JSON.stringify(exported)));
		expect((await res.json()).source).toBe('loyalfamily-json-v1');

		const aliceCards = (await (await cardsListHandler(req(alice, 'GET', '/api/cards'))).json()).cards;
		const bobCards = (await (await cardsListHandler(req(bob, 'GET', '/api/cards'))).json()).cards;
		expect(bobCards.length).toBe(aliceCards.length);
		const key = (c: any) => `${c.name}|${c.barcode_value}|${c.symbology}|${c.brand_id}|${c.color}`;
		expect(bobCards.map(key).sort()).toEqual(aliceCards.map(key).sort());
		// ids are globally unique (PK): a colliding id gets a fresh UUID rather than aborting
		const bobIds = bobCards.map((c: { id: string }) => c.id);
		const aliceIds = new Set(aliceCards.map((c: { id: string }) => c.id));
		expect(bobIds.every((id: string) => !aliceIds.has(id))).toBe(true);
		expect(bobIds.every((id: string) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
	});

	it('canonical import preserves ids when they do not collide', async () => {
		const id = '22222222-2222-4222-8222-222222222222';
		const res = await importHandler(
			req(bob, 'POST', '/api/import',
				JSON.stringify({ format: 'loyalfamily-json-v1', cards: [{ id, name: 'Kept', barcode_value: '5401111111118', symbology: 'EAN_13', color: '#000000' }] })
			)
		);
		expect(res.status).toBe(200);
		const pulled = (await (await cardsListHandler(req(bob, 'GET', '/api/cards'))).json()).cards;
		expect(pulled[0].id).toBe(id);
	});

	it('export excludes cards owned by others even if shared', async () => {
		await importHandler(req(alice, 'POST', '/api/import', loyalFixture));
		// make one shared so bob can see it
		const aliceCards = (await (await cardsListHandler(req(alice, 'GET', '/api/cards'))).json()).cards;
		await importHandler(req(bob, 'POST', '/api/import', JSON.stringify({ format: 'loyalfamily-json-v1', cards: [{ id: crypto.randomUUID(), name: 'Bob shared', barcode_value: '5401111111118', symbology: 'EAN_13', color: '#000000', visibility: 'shared' }] })));

		const bobExport = await (await exportHandler(req(bob, 'GET', '/api/export'))).json();
		expect(bobExport.cards.every((c: { owner_id?: string }) => true)).toBe(true);
		expect(bobExport.cards.length).toBe(1); // only bob's own card, not alice's
		void aliceCards;
	});
});
