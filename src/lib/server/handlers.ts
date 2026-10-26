/**
 * Testable request handlers: plain (Request) => Promise<Response> functions.
 * +server.ts files are thin wrappers that re-export them as kit verbs.
 */
import { error, json, parseJsonBody, requireUser, passwordThrottle, recordPasswordFailure, clearPasswordFailures } from './api';
import { countUsers, createUser, hashPassword, findByUsername, toPublicUser, verifyPassword } from './users';
import { createSessionToken, sessionCookieHeader } from './sessions';
import { validDisplayName, validPassword, validUsername } from '$lib/domain/validation';

/**
 * First-run registration: allowed ONLY while the users table is empty.
 * The first user becomes the administrator (REQUIREMENTS §7).
 */
export async function registerHandler(request: Request): Promise<Response> {
	if (countUsers() > 0) {
		return error('registration is closed; ask an admin for an invite link', 403);
	}
	const body = await parseJsonBody(request);
	if (!body) return error('invalid request body', 400);

	const { username, display_name, password } = body;
	if (!validUsername(username)) return error('username must be 3-32 chars: lowercase letters, digits, _ or .', 400);
	if (!validDisplayName(display_name)) return error('display name is required (1-64 chars)', 400);
	if (!validPassword(password)) return error('password must be at least 8 characters', 400);

	const user = createUser({
		username,
		displayName: String(display_name).trim(),
		passwordHash: await hashPassword(password),
		role: 'admin'
	});
	return json(user, 201, { 'set-cookie': sessionCookieHeader(createSessionToken(user.id, 0)) }); // new user: token_version 0
}

export async function loginHandler(request: Request, clientAddress = ''): Promise<Response> {
	const body = await parseJsonBody(request);
	if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
		return error('username and password are required', 400);
	}
	const key = `login|${body.username.toLowerCase()}|${clientAddress}`;
	const blocked = passwordThrottle(key);
	if (blocked) return blocked;
	const user = findByUsername(body.username);
	// generic error: no user enumeration
	if (!user || !(await verifyPassword(user.password_hash, body.password))) {
		recordPasswordFailure(key);
		return error('invalid username or password', 401);
	}
	clearPasswordFailures(key);
	return json(toPublicUser(user), 200, {
		'set-cookie': sessionCookieHeader(createSessionToken(user.id, user.token_version))
	});
}

export function meHandler(request: Request): Response {
	const { user, unauthorized } = requireUser(request);
	if (unauthorized) return unauthorized;
	return json(user);
}
