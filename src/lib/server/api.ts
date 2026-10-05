import { getUser, toPublicUser } from './users';
import { readSessionToken, verifySessionToken } from './sessions';
import type { PublicUser } from '$lib/types';

export function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json', ...headers }
	});
}

export function error(message: string, status: number): Response {
	return json({ error: message }, status);
}

/** Resolve the session user from the request cookie, or null. */
export function sessionUser(request: Request): PublicUser | null {
	const token = readSessionToken(request);
	if (!token) return null;
	const uid = verifySessionToken(token);
	if (!uid) return null;
	const user = getUser(uid);
	return user ? toPublicUser(user) : null;
}

/** Returns the user or a ready-to-return 401 response. */
export function requireUser(
	request: Request
): { user: PublicUser; unauthorized?: undefined } | { user?: undefined; unauthorized: Response } {
	const user = sessionUser(request);
	if (!user) return { unauthorized: error('unauthorized', 401) };
	return { user };
}

export async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
	try {
		const body = await request.json();
		if (body && typeof body === 'object') return body as Record<string, unknown>;
		return null;
	} catch {
		return null;
	}
}
