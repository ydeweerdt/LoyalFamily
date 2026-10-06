import type { Card, PublicUser } from '$lib/types';

/**
 * Pure grid logic: cards → brand tiles (REQUIREMENTS §2).
 * One tile per brand; custom ("Unknown") cards group by free-text name.
 */

export interface Tile {
	key: string;
	name: string;
	color: string;
	brand_id: string | null;
	cards: Card[];
	/** ≥2 visible cards → count badge */
	count: number;
	/** at least one of MY private cards in this tile → 🔒 badge */
	hasMyPrivate: boolean;
}

export function tileKey(card: Card): string {
	return card.brand_id ? `b:${card.brand_id}` : `c:${card.name.toLowerCase()}`;
}

/** Visible to the user: own cards (any visibility) + shared cards (domain rule). */
export function isVisible(card: Card, user: PublicUser): boolean {
	return card.owner_id === user.id || card.visibility === 'shared';
}

export function buildTiles(cards: Card[], user: PublicUser): Tile[] {
	const groups = new Map<string, Card[]>();
	for (const card of cards) {
		if (!isVisible(card, user)) continue;
		const key = tileKey(card);
		const list = groups.get(key);
		if (list) list.push(card);
		else groups.set(key, [card]);
	}

	const tiles: Tile[] = [];
	for (const [key, list] of groups) {
		const first = list[0];
		tiles.push({
			key,
			name: first.name,
			color: first.color,
			brand_id: first.brand_id,
			cards: list.sort((a, b) => (a.comment ?? a.name).localeCompare(b.comment ?? b.name)),
			count: list.length,
			hasMyPrivate: list.some((c) => c.owner_id === user.id && c.visibility === 'private')
		});
	}

	// automatic alphabetical ordering (Decided #7)
	return tiles.sort((a, b) => a.name.localeCompare(b.name));
}
