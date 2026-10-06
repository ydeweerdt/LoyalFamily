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
import { flushQueue, type QueuedOp, type QueueStore, type Transport } from '$lib/sync';

/**
 * Golden offline flow (DESIGN §8): mutations made offline sit in the queue,
 * then replay against the real API handlers on reconnect, then the full pull
 * shows the reconciled truth.
 */

let alice: string;

beforeEach(() => {
	resetDb(':memory:');
	alice = createUser({ username: 'alice', displayName: 'Alice', passwordHash: 'x', role: 'user' }).id;
});

function asReq(userId: string, method: string, url: string, body?: unknown): Request {
	return new Request(`http://localhost${url}`, {
		method,
		headers: { 'content-type': 'application/json', cookie: `session=${createSessionToken(userId)}` },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

function memQueue(ops: QueuedOp[] = []): QueueStore {
	return {
		get: async () => [...ops].sort((a, b) => a.ts - b.ts),
		add: async (o) => void ops.push(o),
		remove: async (ids) => {
			for (let i = ops.length - 1; i >= 0; i--) if (ids.includes(ops[i].id)) ops.splice(i, 1);
		}
	};
}

/** Transport straight onto the server handlers — the same routes the browser hits. */
function handlerTransport(userId: string): Transport {
	return {
		async send(op) {
			let res: Response;
			if (op.op === 'create') {
				res = await createCardHandler(asReq(userId, 'POST', '/api/cards', { id: op.card_id, ...op.payload }));
			} else if (op.op === 'update') {
				res = await updateCardHandler(asReq(userId, 'PUT', `/api/cards/${op.card_id}`, op.payload), op.card_id);
			} else {
				res = await deleteCardHandler(asReq(userId, 'DELETE', `/api/cards/${op.card_id}`), op.card_id);
			}
			if (res.ok) return { ok: true, retry: false };
			if (res.status >= 500) return { ok: false, retry: true };
			return { ok: false, retry: false };
		}
	};
}

const cardPayload = {
	brand_id: 'delhaize',
	name: 'Delhaize',
	color: '#e30613',
	barcode_value: '4501234567890',
	symbology: 'EAN_13',
	visibility: 'shared',
	comment: null
};

// server validates client-generated ids as UUIDs — queue tests must use real ones
const ID1 = 'deadbeef-0000-4000-8000-000000000001';
const ID2 = 'deadbeef-0000-4000-8000-000000000002';

async function pull() {
	return (await (await cardsListHandler(asReq(alice, 'GET', '/api/cards'))).json()).cards as { id: string }[];
}

describe('offline queue replay against the real API (golden flow)', () => {
	it('card created offline appears after reconnect replay + pull', async () => {
		const q = memQueue();
		await q.add({ id: 'q1', card_id: ID1, op: 'create', payload: cardPayload, ts: 1 });

		expect((await pull()).map((c) => c.id)).not.toContain(ID1); // still offline

		const res = await flushQueue(q, handlerTransport(alice));
		expect(res).toEqual({ flushed: 1, queued: 0 });
		expect((await pull()).map((c) => c.id)).toContain(ID1);
	});

	it('offline create + rename coalesce into one server-side create with final value', async () => {
		const q = memQueue();
		await q.add({ id: 'q1', card_id: ID1, op: 'create', payload: cardPayload, ts: 1 });
		await q.add({ id: 'q2', card_id: ID1, op: 'update', payload: { name: 'Delhaize (old)' }, ts: 2 });

		const res = await flushQueue(q, handlerTransport(alice));
		expect(res.flushed).toBe(1);

		const cards = (await (await cardsListHandler(asReq(alice, 'GET', '/api/cards'))).json()).cards;
		expect(cards[0].name).toBe('Delhaize (old)');
	});

	it('offline edit and delete replay correctly', async () => {
		// online create first
		await createCardHandler(asReq(alice, 'POST', '/api/cards', { id: ID1, ...cardPayload }));

		const q = memQueue();
		await q.add({ id: 'q1', card_id: ID1, op: 'update', payload: { comment: 'main card' }, ts: 1 });
		await q.add({ id: 'q2', card_id: ID1, op: 'delete', payload: {}, ts: 2 });

		const res = await flushQueue(q, handlerTransport(alice));
		expect(res.flushed).toBe(1); // coalesced to a single delete
		expect(await pull()).toHaveLength(0); // tombstone excluded from full pull
	});

	it('invalid queued op is dropped, valid ones still land', async () => {
		const q = memQueue();
		await q.add({ id: 'q1', card_id: ID1, op: 'create', payload: { ...cardPayload, symbology: 'AZTEC' }, ts: 1 });
		await q.add({ id: 'q2', card_id: ID2, op: 'create', payload: cardPayload, ts: 2 });

		const res = await flushQueue(q, handlerTransport(alice));
		expect(res).toEqual({ flushed: 1, queued: 0 });
		expect((await pull()).map((c) => c.id)).toEqual([ID2]);
	});

	it('replayed create keeps the client-generated id (no id mapping anywhere)', async () => {
		const q = memQueue();
		await q.add({ id: 'q1', card_id: ID1, op: 'create', payload: cardPayload, ts: 1 });
		await flushQueue(q, handlerTransport(alice));
		expect((await pull()).map((c) => c.id)).toContain(ID1);
	});
});
