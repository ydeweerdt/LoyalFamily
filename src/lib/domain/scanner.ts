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
	BarcodeFormat.EAN_8,
	BarcodeFormat.UPC_A,
	BarcodeFormat.UPC_E,
	BarcodeFormat.CODE_128,
	BarcodeFormat.CODE_39,
	BarcodeFormat.CODE_93,
	BarcodeFormat.ITF,
	BarcodeFormat.CODABAR,
	BarcodeFormat.QR_CODE,
	BarcodeFormat.AZTEC,
	BarcodeFormat.DATA_MATRIX,
	BarcodeFormat.PDF_417
];

/** ZXing BarcodeFormat is a NUMERIC enum — reverse-map to the name string. */
export function formatName(f: BarcodeFormat): string {
	return BarcodeFormat[f];
}

/**
 * ZXing BarcodeFormat → canonical app symbology (Card['symbology']).
 * Native BarcodeDetector reports lowercase names ('ean_13', 'data_matrix'),
 * ZXing reports the enum value ('EAN_13', 'DATA_MATRIX') — both normalize here
 * by dropping underscores (EAN_8/ean_8 → EAN8).
 * Anything else → undefined = unsupported.
 */
const CANONICAL: Record<string, Card['symbology']> = {
	EAN8: 'EAN_8',
	EAN13: 'EAN_13',
	UPCA: 'UPC_A',
	UPCE: 'UPC_E',
	ITF: 'ITF',
	CODABAR: 'CODABAR',
	CODE39: 'CODE_39',
	CODE93: 'CODE_93',
	CODE128: 'CODE_128',
	QR: 'QR',
	QRCODE: 'QR',
	AZTEC: 'AZTEC',
	DATAMATRIX: 'DATA_MATRIX',
	PDF417: 'PDF_417'
};

export function mapFormat(raw: string): Card['symbology'] | undefined {
	return CANONICAL[raw.toUpperCase().replace(/_/g, '')];
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
