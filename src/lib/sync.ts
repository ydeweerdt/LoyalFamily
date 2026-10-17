/**
 * Sync core (DESIGN §4/§6): offline mutation queue + replay.
 * Pure and transport-agnostic so the whole model is unit/integration-testable
 * without a browser. The browser wiring (fetch + IndexedDB) injects real deps.
 *
 * Model: mutations are queued locally, replayed FIFO per card, then a full
 * pull reconciles. Last-write-wins — no conflict detection (family scale).
 */

export interface QueuedOp {
	id: string; // queue entry id
	card_id: string;
	op: 'create' | 'update' | 'delete';
	payload: Record<string, unknown>;
	ts: number;
}

export interface CoalescedOp {
	card_id: string;
	op: 'create' | 'update' | 'delete';
	payload: Record<string, unknown>;
	sources: string[]; // queue entry ids merged into this op
}

export interface QueueStore {
	get(): Promise<QueuedOp[]>;
	add(op: QueuedOp): Promise<void>;
	remove(ids: string[]): Promise<void>;
}

export interface Transport {
	/** retry=true → network/5xx, op stays queued; retry=false, ok=false → 4xx, op is dropped. */
	send(op: CoalescedOp): Promise<{ ok: boolean; retry: boolean }>;
}

/**
 * Collapse per-card op history into one op per card, preserving first-seen order:
 *   create + update  → create (merged payload)
 *   update + update  → update (merged patch)
 *   anything + delete → delete
 *   delete + update  → delete (resurrection not supported; re-add uses a new UUID)
 */
export function coalesce(ops: QueuedOp[]): CoalescedOp[] {
	const byCard = new Map<string, CoalescedOp>();
	const order: string[] = [];
	for (const op of ops) {
		const cur = byCard.get(op.card_id);
		if (!cur) {
			byCard.set(op.card_id, {
				card_id: op.card_id,
				op: op.op,
				payload: { ...(op.payload ?? {}) },
				sources: [op.id]
			});
			order.push(op.card_id);
			continue;
		}
		cur.sources.push(op.id);
		if (op.op === 'delete') {
			cur.op = 'delete';
			cur.payload = {};
		} else if (cur.op !== 'delete') {
			cur.op = cur.op === 'update' && op.op === 'update' ? 'update' : cur.op;
			cur.payload = { ...cur.payload, ...(op.payload ?? {}) };
		}
	}
	return order.map((id) => byCard.get(id)!);
}

export interface FlushResult {
	flushed: number;
	queued: number; // ops still queued (network died mid-flush)
	dropped: number; // ops the server rejected permanently (4xx) — the user must be told
}

export async function flushQueue(q: QueueStore, t: Transport): Promise<FlushResult> {
	const ops = coalesce(await q.get());
	let flushed = 0;
	let remaining = 0;
	let dropped = 0;
	for (let i = 0; i < ops.length; i++) {
		const op = ops[i];
		const res = await t.send(op);
		if (res.retry) {
			// network dead → stop this round; FIFO order must not be reordered
			remaining += ops.slice(i).reduce((n, o) => n + o.sources.length, 0);
			break;
		}
		// ok (2xx) or dropped (4xx, e.g. validation) — either way, unqueue
		await q.remove(op.sources);
		if (res.ok) flushed++;
		else dropped += op.sources.length;
	}
	return { flushed, queued: remaining, dropped };
}
