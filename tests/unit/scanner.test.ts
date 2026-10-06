import { describe, it, expect } from 'vitest';
import { formatName, mapFormat, orderedFormats, SCANNABLE } from '$lib/domain/scanner';

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

	it('unsupported symbologies are rejected (not silently mistyped)', () => {
		for (const f of ['EAN_8', 'ITF', 'DATAMATRIX', 'PDF_417', 'CODABAR', 'AZTEC', ' nonsense']) {
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
