import { writable } from 'svelte/store';

export interface SessionUser {
	id: string;
	username: string;
	display_name: string;
	role: 'admin' | 'user';
}

export const session = writable<{ user: SessionUser | null; loaded: boolean }>({
	user: null,
	loaded: false
});

/**
 * Display-only session mirror. The auth cookie stays HttpOnly; this exists so
 * the app shell still knows *who you are* when offline (the /api/me probe
 * fails, but the cards are in IndexedDB and the nav should not flip to
 * "Sign in"). Server-side auth still enforces everything on reconnect.
 */
const LS_KEY = 'loyalfamily.session';

function readLocal(): SessionUser | null {
	try {
		const raw = localStorage.getItem(LS_KEY);
		return raw ? (JSON.parse(raw) as SessionUser) : null;
	} catch {
		return null;
	}
}

export async function refreshSession(): Promise<void> {
	try {
		const r = await fetch('/api/me', { credentials: 'same-origin' });
		if (r.ok) {
			const user = (await r.json()) as SessionUser;
			localStorage.setItem(LS_KEY, JSON.stringify(user));
			session.set({ user, loaded: true });
			return;
		}
		if (r.status === 401 || r.status === 403) {
			// the server explicitly says: this cookie is no longer valid
			localStorage.removeItem(LS_KEY);
			session.set({ user: null, loaded: true });
			return;
		}
		// 5xx (e.g. proxy 502 while the container is down): server is
		// unreachable, not rejecting us — keep the last known session
		session.set({ user: readLocal(), loaded: true });
	} catch {
		// offline: keep the last known session for the UI
		session.set({ user: readLocal(), loaded: true });
	}
}

export async function logout(): Promise<void> {
	try {
		await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
	} finally {
		localStorage.removeItem(LS_KEY);
		await refreshSession();
	}
}
