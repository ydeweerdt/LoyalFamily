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
	const sess = verifySessionToken(token);
	if (!sess) return null;
	const user = getUser(sess.uid);
	// per-user token_version: bumping it revokes every cookie issued earlier
	// (REQUIREMENTS §7 — remove/demote/password-reset ends sessions immediately)
	if (!user || user.token_version !== sess.tokenVersion) return null;
	return toPublicUser(user);
}

/** Returns the user or a ready-to-return 401 response. */
export function requireUser(
	request: Request
): { user: PublicUser; unauthorized?: undefined } | { user?: undefined; unauthorized: Response } {
	const user = sessionUser(request);
	if (!user) return { unauthorized: error('unauthorized', 401) };
	return { user };
}

/** Returns the admin or a ready-to-return 401/403 response. */
export function requireAdmin(
	request: Request
): { user: PublicUser; denied?: undefined } | { user?: undefined; denied: Response } {
	const r = requireUser(request);
	if (r.unauthorized) return { denied: r.unauthorized };
	if (r.user.role !== 'admin') return { denied: error('admin access required', 403) };
	return { user: r.user };
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

/**
 * Backstop for the two endpoints that verify a password (login, self-service
 * change): 5 failures on the same username+IP freeze that pair for 15 minutes.
 * In-memory on purpose — a restart clears it, and the real limiter belongs in the
 * TLS proxy (UserGuide §6). Without it, argon2 verification is an online
 * brute-force target and every attempt costs the server CPU.
 * /api/join is not throttled: it rejects a bad/used/expired invite token before it
 * hashes anything, and 128-bit random tokens are not guessable. /api/register is
 * closed the moment the first user exists.
 */
const failedAttempts = new Map<string, { n: number; blockedUntil: number }>();

export function passwordThrottle(key: string): Response | null {
	const a = failedAttempts.get(key);
	if (a && a.blockedUntil > Date.now()) return error('too many failed attempts, try again later', 429);
	return null;
}

export function recordPasswordFailure(key: string): void {
	if (failedAttempts.size > 10_000) failedAttempts.clear(); // shortcut: no LRU, a family-sized app never gets here
	const a = failedAttempts.get(key) ?? { n: 0, blockedUntil: 0 };
	if (a.blockedUntil > Date.now()) return;
	a.n += 1;
	if (a.n >= 5) {
		a.blockedUntil = Date.now() + 15 * 60_000;
		a.n = 0;
	}
	failedAttempts.set(key, a);
}

export function clearPasswordFailures(key: string): void {
	failedAttempts.delete(key);
}
