/**
 * 2D symbologies drawn with the same library that reads them. JsBarcode is 1D only,
 * and `qrcode` always encodes in byte mode at level M, so a re-rendered QR came out
 * a different size and pattern from the one that was scanned. ZXing's writer picks the
 * compact mode (numeric / alphanumeric / byte) the reference encoders use, so a scanned
 * value re-encodes to the symbol the original generator produced.
 * AZTEC and DATA_MATRIX come from @zxing/library's writers as a BitMatrix → SVG.
 * shortcut: PDF_417 has no writer in our dependency set (ZXing-js ships only a
 * PDF417 *reader*); those cards show the raw value. Upgrade by adding a PDF417
 * encoder if real cards turn out to need it.
 */
import {
	AztecCodeWriter,
	BarcodeFormat,
	DataMatrixWriter,
	EncodeHintType,
	QRCodeWriter,
	type BitMatrix
} from '@zxing/library';

const WRITERS: Record<string, (value: string) => BitMatrix> = {
	// ZXing's QR writer defaults to error-correction level L and already pads the symbol
	// with the spec's 4-module quiet zone; the AZTEC / DATA_MATRIX writers do not.
	QR: (v) => {
		const hints = new Map();
		hints.set(EncodeHintType.CHARACTER_SET, 'UTF-8');
		return new QRCodeWriter().encode(v, BarcodeFormat.QR_CODE, 0, 0, hints);
	},
	AZTEC: (v) => new AztecCodeWriter().encode(v, BarcodeFormat.AZTEC, 0, 0),
	DATA_MATRIX: (v) => new DataMatrixWriter().encode(v, BarcodeFormat.DATA_MATRIX, 0, 0)
};

/** Modules of white border to add around what the writer returned. */
const QUIET: Record<string, number> = { QR: 0 };

export function isWriterRendered(symbology: string): boolean {
	return symbology in WRITERS;
}

/** BitMatrix → SVG, dark modules merged into per-row runs, standard 4-module quiet zone. */
export function svg2d(value: string, symbology: string): string {
	const m = WRITERS[symbology](value);
	const w = m.getWidth();
	const h = m.getHeight();
	const q = QUIET[symbology] ?? 4;
	const d: string[] = [];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (!m.get(x, y)) continue;
			let run = 1;
			while (x + run < w && m.get(x + run, y)) run++;
			d.push(`M${x + q} ${y + q}h${run}v1h-${run}z`);
			x += run - 1;
		}
	}
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w + 2 * q} ${h + 2 * q}" shape-rendering="crispEdges">` +
		`<rect width="100%" height="100%" fill="#ffffff"/><path fill="#000000" d="${d.join('')}"/></svg>`
	);
}
