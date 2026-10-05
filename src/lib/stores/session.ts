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

export async function refreshSession(): Promise<void> {
	try {
		const r = await fetch('/api/me', { credentials: 'same-origin' });
		session.set({ user: r.ok ? await r.json() : null, loaded: true });
	} catch {
		session.set({ user: null, loaded: true });
	}
}

export async function logout(): Promise<void> {
	await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
	await refreshSession();
}
