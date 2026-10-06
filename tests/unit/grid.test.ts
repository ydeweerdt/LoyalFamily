import { describe, it, expect } from 'vitest';
import { monogram, searchBrands, BRANDS } from '$lib/brands';
import { buildTiles, tileKey } from '$lib/domain/cards';
import type { Card, PublicUser } from '$lib/types';

const alice: PublicUser = { id: 'alice', username: 'alice', display_name: 'Alice', role: 'user' };
const bob: PublicUser = { id: 'bob', username: 'bob', display_name: 'Bob', role: 'user' };

function card(overrides: Partial<Card> = {}): Card {
	return {
		id: crypto.randomUUID(),
		owner_id: 'alice',
		brand_id: 'delhaize',
		name: 'Delhaize',
		color: '#e30613',
		barcode_value: '1234567',
		symbology: 'EAN_13',
		visibility: 'private',
		comment: null,
		created_at: '',
		updated_at: '',
		updated_by: 'alice',
		deleted_at: null,
		...overrides
	};
}

describe('brand catalog', () => {
	it('search is case-insensitive and matches substrings', () => {
		expect(searchBrands('del').map((b) => b.id)).toContain('delhaize');
		expect(searchBrands('DELHAIZE')).toHaveLength(1);
		expect(searchBrands('nonexistent')).toHaveLength(0);
	});
	it('results are sorted alphabetically', () => {
		const names = searchBrands('').map((b) => b.name);
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
	});
	it('monogram', () => {
		expect(monogram('Colruyt / Bonus')).toBe('CB');
		expect(monogram('Delhaize')).toBe('DE');
	});
	it('catalog has valid colors and unique ids', () => {
		const ids = new Set(BRANDS.map((b) => b.id));
		expect(ids.size).toBe(BRANDS.length);
		for (const b of BRANDS) expect(b.color).toMatch(/^#[0-9a-fA-F]{6}$/);
	});
});

describe('grid tiles (REQUIREMENTS §2)', () => {
	it('groups multiple cards of the same brand into one tile with count', () => {
		const tiles = buildTiles([card({ comment: 'mijn' }), card({ comment: 'familie', visibility: 'shared' })], alice);
		expect(tiles).toHaveLength(1);
		expect(tiles[0].count).toBe(2);
		expect(tiles[0].hasMyPrivate).toBe(true); // alice has her own private card
	});

	it("bob does not see alice's private card, only the shared one", () => {
		const tiles = buildTiles([card(), card({ visibility: 'shared' })], bob);
		expect(tiles).toHaveLength(1);
		expect(tiles[0].count).toBe(1);
		expect(tiles[0].hasMyPrivate).toBe(false);
	});

	it('custom cards group by free-text name (case-insensitive)', () => {
		const tiles = buildTiles(
			[card({ brand_id: null, name: 'Local Bakery' }), card({ brand_id: null, name: 'local bakery' })],
			alice
		);
		expect(tiles).toHaveLength(1);
		expect(tiles[0].count).toBe(2);
	});

	it('tiles are ordered alphabetically', () => {
		const tiles = buildTiles(
			[
				card({ brand_id: 'carrefour', name: 'Carrefour' }),
				card({ brand_id: 'delhaize', name: 'Delhaize' }),
				card({ brand_id: 'aldi', name: 'Aldi' })
			],
			alice
		);
		expect(tiles.map((t) => t.name)).toEqual(['Aldi', 'Carrefour', 'Delhaize']);
	});

	it('tileKey distinguishes brands from custom cards', () => {
		expect(tileKey(card())).toBe('b:delhaize');
		expect(tileKey(card({ brand_id: null, name: 'X' }))).toBe('c:x');
	});
});
