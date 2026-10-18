/**
 * 2D symbologies neither JsBarcode (1D only) nor `qrcode` (QR only) can draw.
 * AZTEC and DATA_MATRIX come from @zxing/library's writers as a BitMatrix → SVG.
 * shortcut: PDF_417 has no writer in our dependency set (ZXing-js ships only a
 * PDF417 *reader*); those cards show the raw value. Upgrade by adding a PDF417
 * encoder if real cards turn out to need it.
 */
import { AztecCodeWriter, BarcodeFormat, DataMatrixWriter, type BitMatrix } from '@zxing/library';

const WRITERS: Record<string, (value: string) => BitMatrix> = {
	AZTEC: (v) => new AztecCodeWriter().encode(v, BarcodeFormat.AZTEC, 0, 0),
	DATA_MATRIX: (v) => new DataMatrixWriter().encode(v, BarcodeFormat.DATA_MATRIX, 0, 0)
};

export function isWriterRendered(symbology: string): boolean {
	return symbology in WRITERS;
}

/** BitMatrix → SVG, dark modules merged into per-row runs, standard 4-module quiet zone. */
export function svg2d(value: string, symbology: string): string {
	const m = WRITERS[symbology](value);
	const w = m.getWidth();
	const h = m.getHeight();
	const q = 4;
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
