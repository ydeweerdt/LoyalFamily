/**
 * Invites (REQUIREMENTS §7): single-use, 7-day expiring links.
 * No email infrastructure — an admin creates an invite and shares the link.
 */
import crypto from 'node:crypto';
import { db } from './db';

export interface Invite {
	id: string;
	token: string;
	created_by: string;
	expires_at: string;
	used_by: string | null;
	used_at: string | null;
}

export const INVITE_TTL_DAYS = 7;

export function createInvite(createdBy: string): Invite {
	const invite: Invite = {
		id: crypto.randomUUID(),
		token: crypto.randomBytes(16).toString('hex'), // 128-bit random token
		created_by: createdBy,
		expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString(),
		used_by: null,
		used_at: null
	};
	db()
		.prepare('INSERT INTO invites (id, token, created_by, expires_at) VALUES (?, ?, ?, ?)')
		.run(invite.id, invite.token, invite.created_by, invite.expires_at);
	return invite;
}

export function getInviteByToken(token: string): Invite | undefined {
	return db().prepare('SELECT * FROM invites WHERE token = ?').get(token) as Invite | undefined;
}

export function listInvites(): Invite[] {
	return db().prepare('SELECT * FROM invites ORDER BY used_at ASC, expires_at DESC').all() as Invite[];
}

/** Only unused invites can be revoked. */
export function revokeInvite(id: string): boolean {
	return db().prepare('DELETE FROM invites WHERE id = ? AND used_by IS NULL').run(id).changes > 0;
}

export function redeemInvite(token: string, userId: string): void {
	db()
		.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE token = ?')
		.run(userId, new Date().toISOString(), token);
}
