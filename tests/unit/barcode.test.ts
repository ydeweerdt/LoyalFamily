/**
 * Barcode round-trip tests (DESIGN §8): render with the exact libraries the app
 * uses (JsBarcode, node-qrcode) → rasterize → decode with ZXing → assert equality.
 * This is our guarantee that whatever we draw, real scanners can read.
 */
import { describe, it, expect } from 'vitest';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { JSDOM } from 'jsdom';
import {
	BinaryBitmap,
	BarcodeFormat,
	DecodeHintType,
	HybridBinarizer,
	MultiFormatReader,
	RGBLuminanceSource
} from '@zxing/library';

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

function roundTrip1D(value: string, format: string, zxing: BarcodeFormat): string {
	const el = dom.window.document.getElementById('bc')!;
	el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	JsBarcode(el, value, { format, width: 2, height: 60, margin: 10, displayValue: false });
	const img = rasterizeSvg(el.outerHTML);
	return decode(img.pixels, img.width, img.height, zxing);
}

function roundTripQR(value: string): string {
	const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
	const size = qr.modules.size;
	const data = qr.modules.data;
	const scale = 4;
	const quiet = 4;
	const width = (size + quiet * 2) * scale;
	const pixels = new Uint8Array(width * width).fill(255);
	for (let y = 0; y < size; y++)
		for (let x = 0; x < size; x++)
			if (data[y * size + x])
				for (let dy = 0; dy < scale; dy++)
					for (let dx = 0; dx < scale; dx++)
						pixels[(y * scale + quiet * scale + dy) * width + x * scale + quiet * scale + dx] = 0;
	return decode(pixels, width, width, BarcodeFormat.QR_CODE);
}

describe('barcode round-trip: render → decode → equal (DESIGN §8)', () => {
	it('EAN-13', () => {
		for (const v of ['4006381333931', '5400141092769', '0123456789012']) {
			expect(roundTrip1D(v, 'ean13', BarcodeFormat.EAN_13)).toBe(v);
		}
	});

	it('UPC-A', () => {
		for (const v of ['590123412342', '722310011841']) {
			expect(roundTrip1D(v, 'upc', BarcodeFormat.UPC_A)).toBe(v);
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
			expect(roundTripQR(v)).toBe(v);
		}
	});

	it('invalid EAN-13 checksum is rejected by the renderer (component shows fallback)', () => {
		const el = dom.window.document.getElementById('bc')!;
		let valid = true;
		JsBarcode(el, '4006381333932', { format: 'ean13', valid: (v: boolean) => (valid = v) });
		expect(valid).toBe(false);
	});
});
