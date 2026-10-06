/**
 * Pure scanner helpers: symbology universe, brand-hint prioritization,
 * raw detector format names → our canonical symbology names.
 * (The camera plumbing lives in Scanner.svelte; this is what we can unit-test.)
 */
import { BarcodeFormat } from '@zxing/library';
import type { Card } from '$lib/types';

/** Symbologies the app supports end-to-end (render + scan). */
export const SCANNABLE: readonly BarcodeFormat[] = [
	BarcodeFormat.EAN_13,
	BarcodeFormat.UPC_A,
	BarcodeFormat.CODE_128,
	BarcodeFormat.CODE_39,
	BarcodeFormat.QR_CODE
];

/** ZXing BarcodeFormat is a NUMERIC enum — reverse-map to the name string. */
export function formatName(f: BarcodeFormat): string {
	return BarcodeFormat[f];
}

/**
 * ZXing BarcodeFormat → canonical app symbology (Card['symbology']).
 * Native BarcodeDetector reports lowercase names ('ean_13', 'qr_code'),
 * ZXing reports the enum value ('EAN_13') — both normalize here.
 * Anything else (EAN_8, ITF, DATAMATRIX…) → undefined = unsupported.
 */
export function mapFormat(raw: string): Card['symbology'] | undefined {
	switch (raw.toUpperCase()) {
		case 'EAN_13':
			return 'EAN_13';
		case 'UPC_A':
			return 'UPC_A';
		case 'CODE_128':
			return 'CODE_128';
		case 'CODE_39':
			return 'CODE_39';
		case 'QR_CODE':
		case 'QR':
			return 'QR';
		default:
			return undefined;
	}
}

/**
 * Formats to feed the detector, brand hint first (REQUIREMENTS §4: hints
 * prioritize the decoder), rest in stable order.
 */
export function orderedFormats(hint?: string): BarcodeFormat[] {
	const list = [...SCANNABLE];
	if (hint) {
		const idx = list.findIndex((f) => mapFormat(formatName(f)) === mapFormat(hint));
		if (idx > 0) list.unshift(...list.splice(idx, 1));
	}
	return list;
}
