/**
 * Browser-side IndexedDB cache of the card set (DESIGN §5/§6).
 * Online: every successful full pull is mirrored here.
 * Offline: the home page renders from here.
 * Milestone 6 adds the mutation queue on top of this store.
 */
import type { Card } from '$lib/types';
import type { QueuedOp } from '$lib/sync';

const DB_NAME = 'loyalfamily';
const DB_VERSION = 2;
const STORE = 'cards';
const QUEUE = 'queue';

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
			if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: 'id' });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function available(): boolean {
	return typeof indexedDB !== 'undefined';
}

/** Replace the whole cached set (full-replacement model). */
export async function cacheCards(cards: Card[]): Promise<void> {
	if (!available()) return;
	try {
		const db = await openDb();
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, 'readwrite');
			const store = tx.objectStore(STORE);
			store.clear();
			for (const c of cards) store.put(c);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	} catch {
		/* cache is best-effort; app still works from network */
	}
}

export async function getCachedCards(): Promise<Card[]> {
	if (!available()) return [];
	try {
		const db = await openDb();
		const cards = await new Promise<Card[]>((resolve, reject) => {
			const tx = db.transaction(STORE, 'readonly');
			const req = tx.objectStore(STORE).getAll();
			req.onsuccess = () => resolve(req.result as Card[]);
			req.onerror = () => reject(req.error);
		});
		db.close();
		return cards;
	} catch {
		return [];
	}
}

/* ---- mutation queue ---- */

export async function enqueueOp(op: QueuedOp): Promise<void> {
	if (!available()) return;
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(QUEUE, 'readwrite');
		tx.objectStore(QUEUE).put(op);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function getQueuedOps(): Promise<QueuedOp[]> {
	if (!available()) return [];
	try {
		const db = await openDb();
		const ops = await new Promise<QueuedOp[]>((resolve, reject) => {
			const tx = db.transaction(QUEUE, 'readonly');
			const req = tx.objectStore(QUEUE).getAll();
			req.onsuccess = () => resolve((req.result as QueuedOp[]).sort((a, b) => a.ts - b.ts));
			req.onerror = () => reject(req.error);
		});
		db.close();
		return ops;
	} catch {
		return [];
	}
}

export async function removeQueuedOps(ids: string[]): Promise<void> {
	if (!available()) return;
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(QUEUE, 'readwrite');
		const store = tx.objectStore(QUEUE);
		for (const id of ids) store.delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}
