import { describe, it, expect } from 'vitest';
import { coalesce, flushQueue, type QueuedOp, type QueueStore, type Transport } from '$lib/sync';

function op(card: string, kind: QueuedOp['op'], payload: Record<string, unknown> = {}): QueuedOp {
	return { id: crypto.randomUUID(), card_id: card, op: kind, payload, ts: Date.now() };
}

function memQueue(ops: QueuedOp[] = []): QueueStore & { ops: QueuedOp[] } {
	return {
		ops,
		get: async () => [...ops].sort((a, b) => a.ts - b.ts),
		add: async (o) => void ops.push(o),
		remove: async (ids) => {
			for (let i = ops.length - 1; i >= 0; i--) if (ids.includes(ops[i].id)) ops.splice(i, 1);
		}
	};
}

describe('coalesce (offline op history → one op per card)', () => {
	it('create + update → single create with merged payload', () => {
		const c = 'card-1';
		const result = coalesce([op(c, 'create', { name: 'A' }), op(c, 'update', { name: 'B' })]);
		expect(result.length).toBe(1);
		expect(result[0].op).toBe('create');
		expect(result[0].payload).toEqual({ name: 'B' });
		expect(result[0].sources.length).toBe(2);
	});

	it('update + update → merged patch, later value wins', () => {
		const c = 'card-1';
		const result = coalesce([op(c, 'update', { name: 'A' }), op(c, 'update', { comment: 'x', name: 'B' })]);
		expect(result.length).toBe(1);
		expect(result[0].op).toBe('update');
		expect(result[0].payload).toEqual({ name: 'B', comment: 'x' });
	});

	it('anything + delete → delete', () => {
		const c = 'card-1';
		const result = coalesce([op(c, 'create', { name: 'A' }), op(c, 'update', { name: 'B' }), op(c, 'delete')]);
		expect(result.length).toBe(1);
		expect(result[0].op).toBe('delete');
	});

	it('delete + update → stays delete (no resurrection; re-add uses a new UUID)', () => {
		const c = 'card-1';
		const result = coalesce([op(c, 'delete'), op(c, 'update', { name: 'B' })]);
		expect(result.length).toBe(1);
		expect(result[0].op).toBe('delete');
	});

	it('different cards keep first-seen order and stay separate', () => {
		const result = coalesce([op('a', 'update', { name: '1' }), op('b', 'create'), op('a', 'update', { name: '2' })]);
		expect(result.map((r) => r.card_id)).toEqual(['a', 'b']);
		expect(result[0].payload).toEqual({ name: '2' });
	});
});

describe('flushQueue (replay semantics)', () => {
	it('successful ops are unqueued', async () => {
		const q = memQueue([op('a', 'create'), op('b', 'delete')]);
		const t: Transport = { send: async () => ({ ok: true, retry: false }) };
		const res = await flushQueue(q, t);
		expect(res).toEqual({ flushed: 2, queued: 0 });
		expect(q.ops.length).toBe(0);
	});

	it('network failure stops the round; FIFO order is never reordered', async () => {
		const q = memQueue([op('a', 'create'), op('b', 'create'), op('c', 'create')]);
		const sent: string[] = [];
		const t: Transport = {
			send: async (o) => {
				sent.push(o.card_id);
				return o.card_id === 'a' ? { ok: false, retry: true } : { ok: true, retry: false };
			}
		};
		const res = await flushQueue(q, t);
		expect(sent).toEqual(['a']); // b and c were NOT attempted behind a failed op
		expect(res).toEqual({ flushed: 0, queued: 3 });
		expect(q.ops.length).toBe(3);
	});

	it('4xx ops are dropped, not retried forever (no poison pill)', async () => {
		const q = memQueue([op('a', 'create', { symbology: 'AZTEC' }), op('b', 'create')]);
		const t: Transport = {
			send: async (o) => (o.card_id === 'a' ? { ok: false, retry: false } : { ok: true, retry: false })
		};
		const res = await flushQueue(q, t);
		expect(res).toEqual({ flushed: 1, queued: 0 });
		expect(q.ops.length).toBe(0); // invalid op discarded; pull will show server truth
	});

	it('coalesced op counts as one send', async () => {
		const q = memQueue([op('a', 'create', { name: 'A' }), op('a', 'update', { name: 'B' })]);
		let sends = 0;
		const t: Transport = {
			send: async (o) => {
				sends++;
				expect(o.payload).toEqual({ name: 'B' });
				return { ok: true, retry: false };
			}
		};
		const res = await flushQueue(q, t);
		expect(sends).toBe(1);
		expect(res.flushed).toBe(1);
	});
});
