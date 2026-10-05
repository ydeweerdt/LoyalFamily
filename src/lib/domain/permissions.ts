import type { Card, PublicUser } from '$lib/types';

/** Pure domain rules — no framework, no DB. 100% unit-testable. */

export function canView(user: PublicUser, card: Card): boolean {
	return card.owner_id === user.id || card.visibility === 'shared';
}

/** Editing (name/color/barcode/comment) is owner-only. */
export function canEdit(user: PublicUser, card: Card): boolean {
	return card.owner_id === user.id;
}

/** Owner may delete; admin may delete any card (cleanup escape hatch). */
export function canDelete(user: PublicUser, card: Card): boolean {
	return card.owner_id === user.id || user.role === 'admin';
}

/** Visibility toggling is owner-only — not even the admin. */
export function canToggleVisibility(user: PublicUser, card: Card): boolean {
	return card.owner_id === user.id;
}

/** The last admin can never be demoted or removed. */
export function canRemoveOrDemoteAdmin(adminCount: number): boolean {
	return adminCount > 1;
}
