/**
 * Client card store: single source of truth for the UI.
 * Mutations: optimistic local update + queued op + immediate send attempt.
 * Network failure → op stays queued, offline flag set, local state already correct.
 * Reconnect / app start → flush queue (FIFO) → full pull reconciles.
 */
import { derived, get, writable } from 'svelte/store';
import { cacheCards, enqueueOp, getCachedCards, getQueuedOps, removeQueuedOps } from '$lib/idb';
import { buildTiles } from '$lib/domain/cards';
import { flushQueue, type CoalescedOp, type QueuedOp } from '$lib/sync';
import { uuid } from '$lib/domain/uuid';
import { session } from '$lib/stores/session';
import type { Card } from '$lib/types';

export const cards = writable<Card[]>([]);
export const offline = writable(false);
/** number of mutations still queued for the server (shown in the offline banner) */
export const pending = writable(0);
export const tiles = derived([cards, session], ([$cards, $session]) =>
	$session.user ? buildTiles($cards, $session.user) : []
);

async function refreshPending(): Promise<void> {
	pending.set((await getQueuedOps()).length);
}

let syncing = false;

async function pull(): Promise<boolean> {
	const r = await fetch('/api/cards', { credentials: 'same-origin' });
	if (!r.ok) throw new Error(String(r.status));
	const list = (await r.json()).cards as Card[];
	cards.set(list);
	void cacheCards(list);
	offline.set(false);
	return true;
}

const queueStore = {
	get: getQueuedOps,
	add: enqueueOp,
	remove: removeQueuedOps
};

async function sendOp(op: CoalescedOp): Promise<{ ok: boolean; retry: boolean }> {
	try {
		const url =
			op.op === 'create' ? '/api/cards' : op.op === 'update' ? `/api/cards/${op.card_id}` : `/api/cards/${op.card_id}`;
		const method = op.op === 'create' ? 'POST' : op.op === 'update' ? 'PUT' : 'DELETE';
		const r = await fetch(url, {
			method,
			credentials: 'same-origin',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(op.op === 'delete' ? {} : op.payload)
		});
		if (r.ok) return { ok: true, retry: false };
		if (r.status >= 500 || r.status === 0) return { ok: false, retry: true };
		return { ok: false, retry: false }; // 4xx: drop the op, full pull will show server truth
	} catch {
		return { ok: false, retry: true }; // network failure
	}
}

/** Flush queued ops then full pull. Safe to call anytime (deduped). */
export async function syncNow(): Promise<void> {
	if (syncing || !get(session).user) return;
	syncing = true;
	try {
		const res = await flushQueue(queueStore, { send: sendOp });
		try {
			await pull();
		} catch {
			offline.set(true);
			cards.set(await getCachedCards());
		}
		if (res.queued > 0) offline.set(true);
		await refreshPending();
	} finally {
		syncing = false;
	}
}

async function mutate(op: QueuedOp, optimistic: (list: Card[]) => Card[]): Promise<{ ok: boolean; error?: string }> {
	await enqueueOp(op);
	cards.update(optimistic);
	// persist the optimistic state to the IDB mirror too: otherwise a remount
	// while offline re-reads stale cache and the local UI loses the change
	void cacheCards(get(cards));
	const res = await flushQueue(queueStore, { send: sendOp });
	await refreshPending();
	if (res.queued > 0) {
		offline.set(true); // stayed queued — local optimistic state stands
		return { ok: true };
	}
	try {
		await pull(); // server truth (also surfaces 4xx drops)
	} catch {
		offline.set(true);
	}
	return { ok: true };
}

export async function addCard(input: {
	id: string;
	brand_id: string | null;
	name: string;
	color: string;
	barcode_value: string;
	symbology: string;
	visibility: 'private' | 'shared';
	comment?: string;
}): Promise<{ ok: boolean; error?: string }> {
	const user = get(session).user;
	if (!user) return { ok: false, error: 'Not signed in' };
	const card: Card = {
		id: input.id,
		owner_id: user.id,
		brand_id: input.brand_id,
		name: input.name,
		color: input.color,
		barcode_value: input.barcode_value,
		symbology: input.symbology as Card['symbology'],
		visibility: input.visibility,
		comment: input.comment ?? null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		updated_by: user.id,
		deleted_at: null
	};
	return mutate(
		{ id: uuid(), card_id: input.id, op: 'create', payload: { ...input }, ts: Date.now() },
		(list) => [...list.filter((c) => c.id !== card.id), card]
	);
}

export async function patchCard(id: string, patch: Record<string, unknown>): Promise<void> {
	await mutate(
		{ id: uuid(), card_id: id, op: 'update', payload: patch, ts: Date.now() },
		(list) => list.map((c) => (c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c))
	);
}

export async function removeCard(id: string): Promise<void> {
	await mutate(
		{ id: uuid(), card_id: id, op: 'delete', payload: {}, ts: Date.now() },
		(list) => list.filter((c) => c.id !== id)
	);
}

export async function loadCards(): Promise<void> {
	if (!get(session).user) {
		cards.set([]);
		return;
	}
	await syncNow();
}
