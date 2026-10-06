import { db } from './db';
import { SYMBOLOGIES, type Card } from '$lib/types';

export interface NewCardInput {
	id: string;
	owner_id: string;
	brand_id: string | null;
	name: string;
	color: string;
	barcode_value: string;
	symbology: string;
	visibility: 'private' | 'shared';
	comment: string | null;
}

export function insertCard(input: NewCardInput): Card {
	const now = new Date().toISOString();
	db()
		.prepare(
			`INSERT INTO cards (id, owner_id, brand_id, name, color, barcode_value, symbology,
				visibility, comment, created_at, updated_at, updated_by)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			input.id, input.owner_id, input.brand_id, input.name, input.color, input.barcode_value,
			input.symbology, input.visibility, input.comment, now, now, input.owner_id
		);
	return getCard(input.id)!;
}

export function getCard(id: string): Card | undefined {
	return db().prepare('SELECT * FROM cards WHERE id = ? AND deleted_at IS NULL').get(id) as
		| Card
		| undefined;
}

/** Full pull (REQUIREMENTS §6): complete visible set; full replacement on the client,
 * so tombstones are not sent — deleted cards simply disappear from the result. */
export function listVisibleCards(userId: string): Card[] {
	return db()
		.prepare(
			`SELECT * FROM cards
			 WHERE deleted_at IS NULL AND (owner_id = ? OR visibility = 'shared')
			 ORDER BY updated_at ASC`
		)
		.all(userId) as Card[];
}

export interface CardPatch {
	name?: string;
	color?: string;
	barcode_value?: string;
	symbology?: string;
	visibility?: 'private' | 'shared';
	comment?: string | null;
}

export function updateCard(id: string, patch: CardPatch, updatedBy: string): Card {
	const now = new Date().toISOString();
	const fields: string[] = [];
	const values: unknown[] = [];
	for (const [k, v] of Object.entries(patch)) {
		if (v === undefined) continue;
		fields.push(`${k} = ?`);
		values.push(v);
	}
	fields.push('updated_at = ?', 'updated_by = ?');
	values.push(now, updatedBy, id);
	db().prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`).run(...values);
	return getCard(id)!;
}

/** Soft delete → tombstone row stays for audit; excluded from full pulls. */
export function softDeleteCard(id: string): void {
	db().prepare('UPDATE cards SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(
		new Date().toISOString(),
		id
	);
}

export { SYMBOLOGIES };
