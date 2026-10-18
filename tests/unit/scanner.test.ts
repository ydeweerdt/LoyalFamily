import { describe, it, expect } from 'vitest';
import { formatName, mapFormat, orderedFormats, SCANNABLE } from '$lib/domain/scanner';
import { SYMBOLOGIES } from '$lib/types';

describe('scanner helpers', () => {
	it('maps ZXing enum names and native lowercase names to canonical symbologies', () => {
		expect(mapFormat('EAN_13')).toBe('EAN_13');
		expect(mapFormat('ean_13')).toBe('EAN_13');
		expect(mapFormat('qr_code')).toBe('QR');
		expect(mapFormat('QR_CODE')).toBe('QR');
		expect(mapFormat('code_128')).toBe('CODE_128');
		expect(mapFormat('upc_a')).toBe('UPC_A');
		expect(mapFormat('code_39')).toBe('CODE_39');
	});

	it('maps every symbology the reader must extract, in both naming styles', () => {
		const both: [string, string][] = [
			['EAN_8', 'EAN_8'],
			['EAN_13', 'EAN_13'],
			['UPC_A', 'UPC_A'],
			['UPC_E', 'UPC_E'],
			['ITF', 'ITF'],
			['CODABAR', 'CODABAR'],
			['CODE_39', 'CODE_39'],
			['CODE_93', 'CODE_93'],
			['CODE_128', 'CODE_128'],
			['QR_CODE', 'QR'],
			['AZTEC', 'AZTEC'],
			['DATA_MATRIX', 'DATA_MATRIX'],
			['PDF_417', 'PDF_417']
		];
		for (const [raw, want] of both) {
			expect(mapFormat(raw), raw).toBe(want);
			expect(mapFormat(raw.toLowerCase()), raw.toLowerCase()).toBe(want);
		}
		// ZXing's own enum spellings (no underscores)
		expect(mapFormat('DATAMATRIX')).toBe('DATA_MATRIX');
		expect(mapFormat('PDF417')).toBe('PDF_417');
	});

	it('the scanner is offered every supported symbology', () => {
		const reported = SCANNABLE.map((f) => mapFormat(formatName(f)));
		expect(new Set(reported).size).toBe(SYMBOLOGIES.length);
		expect(reported.every((s) => SYMBOLOGIES.includes(s as (typeof SYMBOLOGIES)[number]))).toBe(true);
	});

	it('unsupported symbologies are rejected (not silently mistyped)', () => {
		for (const f of ['MAXICODE', 'RSS_14', ' nonsense']) {
			expect(mapFormat(f)).toBeUndefined();
		}
	});

	it('no hint → stable default order', () => {
		expect(orderedFormats().length).toBe(SCANNABLE.length);
	});

	it('brand hint is prioritized but all formats remain available', () => {
		const withHint = orderedFormats('CODE_128');
		expect(formatName(withHint[0])).toBe('CODE_128');
		expect(withHint.length).toBe(SCANNABLE.length);
		expect(new Set(withHint).size).toBe(SCANNABLE.length);

		const qrHint = orderedFormats('QR');
		expect(formatName(qrHint[0])).toBe('QR_CODE');
	});

	it('hint given as canonical app symbology works too', () => {
		expect(formatName(orderedFormats('EAN_13')[0])).toBe('EAN_13');
	});
});
