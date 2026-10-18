/**
 * Barcode round-trip tests (REQUIREMENTS §5a): render with the exact libraries the app
 * uses (JsBarcode, @zxing/library writers) → rasterize → decode with ZXing → assert
 * equality. This is our guarantee that whatever we draw, real scanners can read — for
 * every symbology in SYMBOLOGIES.
 */
import { describe, it, expect } from 'vitest';
import JsBarcode from 'jsbarcode';
import { JSDOM } from 'jsdom';
import { BarcodeFormat, BinaryBitmap, DecodeHintType, EncodeHintType, HybridBinarizer, MultiFormatReader, QRCodeWriter, RGBLuminanceSource } from '@zxing/library';

import { svg2d } from '$lib/domain/render';
import { SCANNABLE } from '$lib/domain/scanner';
import { SYMBOLOGIES } from '$lib/types';
const dom = new JSDOM('<!doctype html><svg id="bc" xmlns="http://www.w3.org/2000/svg"></svg>');
// JsBarcode's SVG renderer needs a DOM
(globalThis as Record<string, unknown>).document = dom.window.document;

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Rasterize JsBarcode's SVG output (a <g transform="translate()"> wrapper around
 * black <rect> bars on implicit white) into a grayscale pixel buffer.
 */
function rasterizeSvg(svg: string, scale = 2, quiet = 20): { pixels: Uint8Array; width: number; height: number } {
	const rects: Rect[] = [];
	let gx = 0;
	let gy = 0;
	for (const tag of svg.matchAll(/<(g|rect|\/g)\b[^>]*>/g)) {
		const t = tag[0];
		if (t.startsWith('</g')) {
			gx = 0;
			gy = 0;
			continue;
		}
		if (t.startsWith('<g')) {
			const tr = /transform="translate\(([-\d.]+)[ ,]+([-\d.]+)\)"/.exec(t);
			gx = tr ? +tr[1] : 0;
			gy = tr ? +tr[2] : 0;
			continue;
		}
		const attr = (n: string) => {
			// NOTE: character class avoids \d — inside a template literal `\d` collapses to `d`
			const m = new RegExp(`${n}="([-0-9.]+)"`).exec(t);
			return m ? +m[1] : 0;
		};
		// JsBarcode emits a full-canvas fill="#ffffff" background rect — skip it,
		// only black bars (group fill #000000) are ink.
		if (/fill="#ffffff"/i.test(t)) continue;
		rects.push({ x: attr('x') + gx, y: attr('y') + gy, w: attr('width'), h: attr('height') });
	}

	if (rects.length === 0) throw new Error('no rects found');
	const minX = Math.min(...rects.map((r) => r.x));
	const minY = Math.min(...rects.map((r) => r.y));
	const maxX = Math.max(...rects.map((r) => r.x + r.w));
	const maxY = Math.max(...rects.map((r) => r.y + r.h));

	const width = Math.ceil((maxX - minX) * scale) + 2 * quiet;
	const height = Math.ceil((maxY - minY) * scale) + 2 * quiet;
	const pixels = new Uint8Array(width * height).fill(255); // white background
	for (const r of rects) {
		const x0 = Math.round((r.x - minX) * scale) + quiet;
		const y0 = Math.round((r.y - minY) * scale) + quiet;
		const x1 = Math.ceil((r.x + r.w - minX) * scale) + quiet;
		const y1 = Math.ceil((r.y + r.h - minY) * scale) + quiet;
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) pixels[y * width + x] = 0;
	}
	return { pixels, width, height };
}

function decode(pixels: Uint8Array, width: number, height: number, format: BarcodeFormat): string {
	const hints = new Map();
	hints.set(DecodeHintType.POSSIBLE_FORMATS, [format]);
	hints.set(DecodeHintType.TRY_HARDER, true);
	// Uint8ClampedArray of length width*height = one luminance byte per pixel.
	// (Int32Array would be misread as ARGB-packed pixels by ZXing.)
	const bitmap = new BinaryBitmap(
		new HybridBinarizer(new RGBLuminanceSource(new Uint8ClampedArray(pixels), width, height))
	);
	return new MultiFormatReader().decode(bitmap, hints).getText();
}

function roundTrip1D(value: string, format: string, zxingFormat: BarcodeFormat): string {
	const el = dom.window.document.getElementById('bc')!;
	el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	JsBarcode(el, value, { format, width: 2, height: 60, margin: 10, displayValue: false });
	const img = rasterizeSvg(el.outerHTML);
	return decode(img.pixels, img.width, img.height, zxingFormat);
}

/** Our 2D SVG → rows of '0'/'1' modules (svg2d merges each row's dark modules into runs). */
function svgModules(svg: string): string[] {
	const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)!;
	const modules: string[][] = Array.from({ length: Number(h) }, () => Array<string>(Number(w)).fill('0'));
	for (const m of svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
		const x = Number(m[1]);
		const y = Number(m[2]);
		for (let i = 0; i < Number(m[3]); i++) modules[y][x + i] = '1';
	}
	return modules.map((r) => r.join(''));
}

/** ZXing BitMatrix → rows of '0'/'1' (already carries the spec's 4-module quiet zone). */
function matrixRows(m: { getWidth(): number; getHeight(): number; get(x: number, y: number): boolean }): string[] {
	return Array.from({ length: m.getHeight() }, (_, y) =>
		Array.from({ length: m.getWidth() }, (_, x) => (m.get(x, y) ? '1' : '0')).join('')
	);
}

function rasterRows(rows: string[], scale = 4, quiet = 8): { pixels: Uint8Array; width: number; height: number } {
	const size = rows[0].length;
	const width = (size + quiet * 2) * scale;
	const height = (rows.length + quiet * 2) * scale;
	const pixels = new Uint8Array(width * height).fill(255);
	rows.forEach((row, y) =>
		[...row].forEach((c, x) => {
			if (c !== '1') return;
			for (let dy = 0; dy < scale; dy++)
				for (let dx = 0; dx < scale; dx++)
					pixels[((y + quiet) * scale + dy) * width + (x + quiet) * scale + dx] = 0;
		})
	);
	return { pixels, width, height };
}

/** The app's own 2D SVG → pixels → ZXing. */
function roundTrip2D(value: string, symbology: string, format: BarcodeFormat): string {
	const img = rasterRows(svgModules(svg2d(value, symbology)));
	return decode(img.pixels, img.width, img.height, format);
}

describe('barcode round-trip: render → decode → equal (REQUIREMENTS §5a)', () => {
	it('every supported symbology is rendered, or has a documented fallback', () => {
		const rendered = ['EAN_8', 'EAN_13', 'UPC_A', 'UPC_E', 'ITF', 'CODABAR', 'CODE_39', 'CODE_93', 'CODE_128', 'QR', 'AZTEC', 'DATA_MATRIX'];
		// PDF_417: @zxing/library ships a PDF417 *reader* only, so the card shows the value.
		expect(SYMBOLOGIES.filter((s) => !rendered.includes(s))).toEqual(['PDF_417']);
	});

	it('the scanner is offered every supported symbology', () => {
		const names = SCANNABLE.map((f) => BarcodeFormat[f]);
		expect(names).toEqual(
			expect.arrayContaining(['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'ITF', 'CODABAR', 'CODE_39', 'CODE_93', 'CODE_128', 'QR_CODE', 'AZTEC', 'DATA_MATRIX', 'PDF_417'])
		);
	});

	it('EAN-13', () => {
		for (const v of ['4006381333931', '5400141092769', '0123456789012']) {
			expect(roundTrip1D(v, 'ean13', BarcodeFormat.EAN_13)).toBe(v);
		}
	});

	it('EAN-8', () => {
		for (const v of ['96385074', '40171234', '12345670']) {
			expect(roundTrip1D(v, 'ean8', BarcodeFormat.EAN_8)).toBe(v);
		}
	});

	it('UPC-A', () => {
		for (const v of ['590123412342', '722310011841']) {
			expect(roundTrip1D(v, 'upc', BarcodeFormat.UPC_A)).toBe(v);
		}
	});

	it('ITF (Interleaved 2 of 5)', () => {
		for (const v of ['123456', '240000000000', '0012345678']) {
			expect(roundTrip1D(v, 'itf', BarcodeFormat.ITF)).toBe(v);
		}
	});

	it('CODABAR (readers report the A…A start/stop characters)', () => {
		for (const v of ['12345678', '0123456789', '1234-5678']) {
			expect(roundTrip1D(v, 'codabar', BarcodeFormat.CODABAR).replace(/^[A-D]|[A-D]$/g, '')).toBe(v);
		}
	});

	it('Code 93', () => {
		for (const v of ['HELLO-123', 'ABC.$/+', 'LOYALFAMILY']) {
			expect(roundTrip1D(v, 'code93', BarcodeFormat.CODE_93)).toBe(v);
		}
	});

	it('Code 128 (incl. special chars and long values)', () => {
		for (const v of [
			'DELHAIZE-4501234567890',
			'ABC xyz!@#123',
			'X'.repeat(80),
			'0123456789'.repeat(30) // ~300 chars
		]) {
			expect(roundTrip1D(v, 'code128', BarcodeFormat.CODE_128)).toBe(v);
		}
	});

	it('Code 39', () => {
		for (const v of ['HELLO-123', 'ABC.$/+', 'LOYALFAMILY']) {
			expect(roundTrip1D(v, 'code39', BarcodeFormat.CODE_39)).toBe(v);
		}
	});

	it('QR (incl. unicode)', () => {
		for (const v of [
			'https://loyalfamily.example/c/abc123',
			'Héllo ✓ 0123456789',
			'4501234567890'
		]) {
			expect(roundTrip2D(v, 'QR', BarcodeFormat.QR_CODE)).toBe(v);
		}
	});

	// "Content is correctly extracted, but the regenerated image looks different": a QR
	// image is not fixed by its content (mode, version, level and mask are encoder
	// choices), so the only honest target is the symbol the reading library itself would
	// have produced. Rendering through ZXing's writer — the family that scans these codes
	// — reproduces it module for module instead of a same-text-but-different symbol.
	// Both sides ask ZXing for UTF-8: its byte mode carries a charset nibble, and the same
	// text encodes to a different symbol without it.
	it('a scanned QR re-renders as the symbol it was, module for module', () => {
		for (const value of ['4501234567890', 'https://dreamland.be/u/abc123', 'ABC123', 'Héllo ✓ 0123456789']) {
			const hints = new Map();
			hints.set(EncodeHintType.CHARACTER_SET, 'UTF-8'); // what render.ts asks for, so scanners agree on the bytes
			const original = new QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 0, 0, hints); // what the card's generator made
			const img = rasterRows(matrixRows(original));
			const scanned = decode(img.pixels, img.width, img.height, BarcodeFormat.QR_CODE);
			expect(scanned).toBe(value);
			expect(svgModules(svg2d(scanned, 'QR'))).toEqual(matrixRows(original));
		}
	});

	it('AZTEC', () => {
		for (const v of ['4501234567890', 'https://loyalfamily.example/c/abc123', 'X'.repeat(100)]) {
			expect(roundTrip2D(v, 'AZTEC', BarcodeFormat.AZTEC)).toBe(v);
		}
	});

	it('DATA_MATRIX', () => {
		for (const v of ['4501234567890', 'https://loyalfamily.example/c/abc123', 'X'.repeat(100)]) {
			expect(roundTrip2D(v, 'DATA_MATRIX', BarcodeFormat.DATA_MATRIX)).toBe(v);
		}
	});

	// ZXing-js (the decoder available to tests) has a broken UPCEReader — it cannot read
	// any UPC-E, ours or hand-built. The native BarcodeDetector reads UPC-E fine, so the
	// structure the spec demands is checked instead: 51 modules, 101 start guard,
	// 010101 end guard.
	it('UPC-E renders 51 modules between the spec guard patterns', () => {
		for (const v of ['012345', '421000', '04210007']) {
			const el = dom.window.document.getElementById('bc')!;
			el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
			JsBarcode(el, v, { format: 'upce', width: 1, height: 40, margin: 0, displayValue: false });
			// rebuild the module string from the bars (width 1 = 1 module, gaps stay 0)
			const bars: { x: number; w: number }[] = [];
			let gx = 0;
			for (const tag of el.outerHTML.matchAll(/<(g|rect|\/g)\b[^>]*>/g)) {
				const t = tag[0];
				if (t.startsWith('</g')) gx = 0;
				else if (t.startsWith('<g')) gx = Number(/translate\(([-\d.]+),/.exec(t)?.[1] ?? 0);
				else if (!/fill="#ffffff"/i.test(t))
					bars.push({ x: Number(/x="([-\d.]+)"/.exec(t)![1]) + gx, w: Number(/width="([-\d.]+)"/.exec(t)![1]) });
			}
			let modules = '';
			let pos = 0;
			for (const b of bars.sort((a, c) => a.x - c.x)) {
				while (pos < b.x) {
					modules += '0';
					pos++;
				}
				while (pos < b.x + b.w) {
					modules += '1';
					pos++;
				}
			}
			expect(modules.length, v).toBe(51);
			expect(modules.startsWith('101'), v).toBe(true); // start guard
			expect(modules.endsWith('010101'), v).toBe(true); // end guard
		}
	});

	it('invalid EAN-13 checksum is rejected by the renderer (component shows fallback)', () => {
		const el = dom.window.document.getElementById('bc')!;
		let valid = true;
		JsBarcode(el, '4006381333932', { format: 'ean13', valid: (v: boolean) => (valid = v) });
		expect(valid).toBe(false);
	});
});
