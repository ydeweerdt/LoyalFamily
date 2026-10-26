/**
 * Invite + admin handlers (REQUIREMENTS §7). Pure functions; +server.ts wraps them.
 */
import { error, json, parseJsonBody, requireAdmin, requireUser, passwordThrottle, recordPasswordFailure, clearPasswordFailures } from './api';
import { createSessionToken, sessionCookieHeader } from './sessions';
import {
	countAdmins,
	createUser,
	deleteUser,
	findByUsername,
	getUser,
	hashPassword,
	listUsers,
	setPasswordHash,
	setUserRole,
	toPublicUser,
	verifyPassword
} from './users';
import { createInvite, getInviteByToken, listInvites, redeemInvite, revokeInvite } from './invites';
import { validDisplayName, validPassword, validUsername } from '$lib/domain/validation';

/* ---------- join (public, invite-token gated) ---------- */

export async function joinHandler(request: Request): Promise<Response> {
	const body = await parseJsonBody(request);
	if (!body || typeof body.token !== 'string') return error('invite token is required', 400);

	const invite = getInviteByToken(body.token);
	if (!invite) return error('invalid invite link', 404);
	if (invite.used_by) return error('this invite link has already been used', 400);
	if (new Date(invite.expires_at) < new Date()) return error('this invite link has expired', 400);

	const { username, display_name, password } = body;
	if (!validUsername(username)) return error('username must be 3-32 chars: lowercase letters, digits, _ or .', 400);
	if (!validDisplayName(display_name)) return error('display name is required (1-64 chars)', 400);
	if (!validPassword(password)) return error('password must be at least 8 characters', 400);
	if (findByUsername(String(username))) return error('username is taken', 409);

	const user = createUser({
		username: String(username),
		displayName: String(display_name).trim(),
		passwordHash: await hashPassword(String(password)),
		role: 'user' // invitees always start as regular users
	});
	redeemInvite(invite.token, user.id);

	return json(user, 201, { 'set-cookie': sessionCookieHeader(createSessionToken(user.id, 0)) }); // new user: token_version 0
}

/* ---------- invites (admin) ---------- */

export async function createInviteHandler(request: Request): Promise<Response> {
	const r = requireAdmin(request);
	if (r.denied) return r.denied;
	return json(createInvite(r.user.id), 201);
}

export function invitesListHandler(request: Request): Response {
	const r = requireAdmin(request);
	if (r.denied) return r.denied;
	const now = new Date();
	const invites = listInvites().map((i) => ({
		id: i.id,
		token: i.token,
		expires_at: i.expires_at,
		used_at: i.used_at,
		expired: new Date(i.expires_at) < now
	}));
	return json({ invites });
}

export function revokeInviteHandler(request: Request, id: string): Response {
	const r = requireAdmin(request);
	if (r.denied) return r.denied;
	return revokeInvite(id) ? json({ ok: true }) : error('invite not found (used invites cannot be revoked)', 404);
}

/* ---------- users (admin) ---------- */

export function usersListHandler(request: Request): Response {
	const r = requireAdmin(request);
	if (r.denied) return r.denied;
	return json({ users: listUsers().map(toPublicUser) });
}

export async function setRoleHandler(request: Request, id: string): Promise<Response> {
	const r = requireAdmin(request);
	if (r.denied) return r.denied;
	const body = await parseJsonBody(request);
	const role = body?.role;
	if (role !== 'admin' && role !== 'user') return error("role must be 'admin' or 'user'", 400);

	const target = getUser(id);
	if (!target) return error('user not found', 404);

	// last-admin guard (REQUIREMENTS §7): never leave the instance without an admin
	if (target.role === 'admin' && role === 'user' && countAdmins() <= 1) {
		return error('cannot demote the last admin', 400);
	}
	setUserRole(id, role);
	return json(toPublicUser(getUser(id)!));
}

export async function adminResetPasswordHandler(request: Request, id: string): Promise<Response> {
	const r = requireAdmin(request);
	if (r.denied) return r.denied;
	const body = await parseJsonBody(request);
	if (!validPassword(body?.password)) return error('password must be at least 8 characters', 400);
	if (!getUser(id)) return error('user not found', 404);
	setPasswordHash(id, await hashPassword(String(body!.password)));
	return json({ ok: true });
}

export function deleteUserHandler(request: Request, id: string): Response {
	const r = requireAdmin(request);
	if (r.denied) return r.denied;
	if (r.user.id === id) return error('you cannot delete your own account', 400);

	const target = getUser(id);
	if (!target) return error('user not found', 404);
	if (target.role === 'admin' && countAdmins() <= 1) return error('cannot delete the last admin', 400);

	deleteUser(id, r.user.id);
	return json({ ok: true });
}

/* ---------- self-service password change ---------- */

export async function changePasswordHandler(request: Request, clientAddress = ''): Promise<Response> {
	const r = requireUser(request);
	if (r.unauthorized) return r.unauthorized;
	const body = await parseJsonBody(request);
	if (!body || typeof body.current_password !== 'string' || !validPassword(body.new_password)) {
		return error('current_password and new_password (≥8 chars) are required', 400);
	}
	const key = `pw|${r.user.id}|${clientAddress}`;
	const blocked = passwordThrottle(key);
	if (blocked) return blocked;
	const user = getUser(r.user.id)!;
	if (!(await verifyPassword(user.password_hash, body.current_password))) {
		recordPasswordFailure(key);
		return error('current password is incorrect', 403);
	}
	clearPasswordFailures(key);
	setPasswordHash(user.id, await hashPassword(String(body.new_password)));
	// token_version was bumped: other devices are logged out, this one gets a fresh cookie
	const fresh = getUser(user.id)!;
	return json({ ok: true }, 200, { 'set-cookie': sessionCookieHeader(createSessionToken(fresh.id, fresh.token_version)) });
}
