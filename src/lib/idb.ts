/**
 * Browser-side IndexedDB cache of the card set (DESIGN §5/§6).
 * Online: every successful full pull is mirrored here.
 * Offline: the home page renders from here.
 * Milestone 6 adds the mutation queue on top of this store.
 */
import type { Card } from '$lib/types';

const DB_NAME = 'loyalfamily';
const STORE = 'cards';

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
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
