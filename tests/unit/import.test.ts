import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { EXPORT_FORMAT, guessSymbology, parseExport, ParseError } from '$lib/domain/import';

const exportFixture = fs.readFileSync('tests/fixtures/loyalfamily_export.json', 'utf8');

describe('LoyalFamily export parser (loyalfamily-json-v1)', () => {
	const result = parseExport(exportFixture);

	it('detects the format and imports the importable cards', () => {
		expect(result.source).toBe(EXPORT_FORMAT);
		expect(result.cards.length).toBe(4);
		expect(result.skipped).toEqual([{ index: 3, reason: 'missing or invalid barcode_value' }]);
	});

	it('keeps brand, symbology, color and comment from the export', () => {
		const delhaize = result.cards.find((c) => c.brand_id === 'delhaize')!;
		expect(delhaize.name).toBe('Delhaize');
		expect(delhaize.symbology).toBe('CODE_128');
		expect(delhaize.color).toBe('#e30613');
		expect(delhaize.comment).toBe('Kaart van papa');
		expect(delhaize.visibility).toBe('private'); // imports start private
		expect(delhaize.id).toBe('11111111-1111-4111-8111-111111111111'); // our own ids are kept
	});

	it('unsupported symbology (ITF) falls back to a guess, custom brand stays null', () => {
		const local = result.cards.find((c) => c.name === 'Local shop')!;
		expect(local.brand_id).toBeNull();
		expect(local.symbology).toBe('CODE_128'); // 8-digit numeric guess
		expect(local.color).toBe('#123456'); // kept from export
	});

	it('QR export maps to our QR symbology', () => {
		const qr = result.cards.find((c) => c.symbology === 'QR')!;
		expect(qr.barcode_value).toBe('https://dreamland.be/u/abc123');
		expect(qr.brand_id).toBe('dreamland');
	});
});

describe('canonical format (loyalfamily-json-v1)', () => {
	it('round-trips a canonical export preserving ids and fields', () => {
		const doc = {
			format: EXPORT_FORMAT,
			exported_at: new Date().toISOString(),
			cards: [
				{
					id: '11111111-1111-4111-8111-111111111111',
					brand_id: 'delhaize',
					name: 'Delhaize',
					color: '#e30613',
					barcode_value: '123456789012345678',
					symbology: 'CODE_128',
					visibility: 'shared',
					comment: 'mine'
				}
			]
		};
		const result = parseExport(JSON.stringify(doc));
		expect(result.source).toBe(EXPORT_FORMAT);
		expect(result.cards[0].id).toBe('11111111-1111-4111-8111-111111111111');
		expect(result.cards[0].visibility).toBe('shared');
	});

	it('accepts a bare array of canonical cards', () => {
		const result = parseExport(
			JSON.stringify([{ id: '11111111-1111-4111-8111-111111111111', name: 'X', barcode_value: '1234567890123', symbology: 'EAN_13', color: '#000000' }])
		);
		expect(result.cards.length).toBe(1);
	});

	it('rejects garbage with a clear ParseError', () => {
		expect(() => parseExport('not json')).toThrow(ParseError);
		expect(() => parseExport('{"nothing": true}')).toThrow(ParseError);
	});

	it('skips invalid canonical entries per-card, not all-or-nothing', () => {
		const result = parseExport(
			JSON.stringify({
				format: EXPORT_FORMAT,
				cards: [{ name: 'no barcode' }, { name: 'ok', barcode_value: '123', color: '#000000' }]
			})
		);
		expect(result.cards.length).toBe(1);
		expect(result.skipped).toEqual([{ index: 0, reason: 'missing or invalid barcode_value' }]);
	});
});

describe('symbology guessing', () => {
	it('guesses from value shape', () => {
		expect(guessSymbology('5401234567894')).toBe('EAN_13');
		expect(guessSymbology('012345678905')).toBe('UPC_A');
		expect(guessSymbology('https://x.be/abc')).toBe('QR');
		expect(guessSymbology('a'.repeat(50))).toBe('QR');
		expect(guessSymbology('AB-123')).toBe('CODE_128');
	});
});
