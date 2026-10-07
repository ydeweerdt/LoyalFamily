/**
 * Import parser (DESIGN §3: pure — text in → cards out).
 *
 * Input is our own export format ("loyalfamily-json-v1") — the exact document
 * /api/export produces, so every backup is re-importable. Forgiving per card:
 * a bad entry is skipped with a reason instead of failing the whole file.
 */
import { validColor, validBarcodeValue, validUuid, validVisibility } from '$lib/domain/validation';
import { uuid } from '$lib/domain/uuid';
import { SYMBOLOGIES, type Card } from '$lib/types';

export const EXPORT_FORMAT = 'loyalfamily-json-v1';

export interface ImportedCard {
	id: string;
	brand_id: string | null;
	name: string;
	color: string;
	barcode_value: string;
	symbology: Card['symbology'];
	visibility: 'private' | 'shared';
	comment: string | null;
}

export interface ParseResult {
	source: 'loyalfamily-json-v1';
	cards: ImportedCard[];
	skipped: { index: number; reason: string }[];
}

export class ParseError extends Error {}

const DEFAULT_COLOR = '#495057';

export function parseExport(text: string): ParseResult {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new ParseError('file is not valid JSON');
	}

	if (Array.isArray(data)) return { ...parseCanonicalList(data), source: 'loyalfamily-json-v1' };
	if (!data || typeof data !== 'object') throw new ParseError('file is not a JSON object or array');

	const obj = data as Record<string, unknown>;
	if (obj.format === EXPORT_FORMAT || Array.isArray(obj.cards)) {
		const cards = Array.isArray(obj.cards) ? obj.cards : [];
		return { ...parseCanonicalList(cards), source: EXPORT_FORMAT };
	}

	throw new ParseError(`unrecognized file: expected a ${EXPORT_FORMAT} export`);
}

/* ---------- canonical ---------- */

function parseCanonicalList(list: unknown[]): Omit<ParseResult, 'source'> {
	const cards: ImportedCard[] = [];
	const skipped: { index: number; reason: string }[] = [];
	list.forEach((raw, index) => {
		if (!raw || typeof raw !== 'object') return void skipped.push({ index, reason: 'not an object' });
		const c = raw as Record<string, unknown>;
		if (!validBarcodeValue(c.barcode_value)) return void skipped.push({ index, reason: 'missing or invalid barcode_value' });
		const symbology = validSymb(c.symbology) ? c.symbology : guessSymbology(c.barcode_value);
		cards.push({
			id: validUuid(c.id) ? c.id : uuid(),
			brand_id: typeof c.brand_id === 'string' ? c.brand_id : null,
			name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : 'Card',
			color: validColor(c.color) ? c.color : DEFAULT_COLOR,
			barcode_value: c.barcode_value,
			symbology,
			visibility: validVisibility(c.visibility) ? c.visibility : 'private',
			comment: typeof c.comment === 'string' ? c.comment : null
		});
	});
	return { cards, skipped };
}

/* ---------- helpers ---------- */

function validSymb(s: unknown): s is Card['symbology'] {
	return typeof s === 'string' && (SYMBOLOGIES as readonly string[]).includes(s);
}

/** Fallback symbology from the value shape when the export carries none. */
export function guessSymbology(value: string): Card['symbology'] {
	if (/^\d{13}$/.test(value)) return 'EAN_13';
	if (/^\d{12}$/.test(value)) return 'UPC_A';
	if (/^https?:\/\//i.test(value) || value.length > 40 || /[^0-9A-Za-z\-_./:]/.test(value)) return 'QR';
	return 'CODE_128';
}
