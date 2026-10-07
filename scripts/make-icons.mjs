/**
 * Generates the PWA icons (barcode motif on brand teal) as PNGs.
 * Dependency-free: hand-rolled PNG encoder using node zlib.
 * Run: docker run --rm -v $PWD/scripts:/app/scripts loyalfamily-deps node scripts/make-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CRC_TABLE = new Uint32Array(256).map((_, i) => {
	let c = i;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c;
});

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const t = Buffer.from(type);
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
	return Buffer.concat([len, t, data, crc]);
}

function png(width, height, rgb) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // color type: RGB
	const raw = Buffer.alloc(height * (1 + width * 3));
	for (let y = 0; y < height; y++) {
		const off = y * (1 + width * 3);
		raw[off] = 0; // filter: none
		rgb.copy(raw, off + 1, y * width * 3, (y + 1) * width * 3);
	}
	return Buffer.concat([
		Buffer.from([137, 80, 71, 71, 13, 10, 26, 10]), // full 8-byte PNG signature
		chunk('IHDR', ihdr),
		chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}

// EAN-like bar pattern: [start, end] pairs as fractions of the barcode area width
const BARS = [
	[0.0, 0.03], [0.05, 0.08], [0.11, 0.13], [0.16, 0.18], [0.21, 0.25],
	[0.28, 0.3], [0.33, 0.35], [0.38, 0.42], [0.45, 0.47], [0.5, 0.52],
	[0.55, 0.58], [0.61, 0.63], [0.66, 0.7], [0.73, 0.75], [0.78, 0.8],
	[0.83, 0.85], [0.88, 0.91], [0.94, 0.97], [0.99, 1.0]
];

function icon(size) {
	const px = Buffer.alloc(size * size * 3);
	const teal = [0x0b, 0x72, 0x85];
	const white = [0xff, 0xff, 0xff];
	// barcode area: 64% of width, centered; bars occupy middle 55% of height
	const areaX0 = size * 0.18;
	const areaW = size * 0.64;
	const y0 = Math.round(size * 0.225);
	const y1 = Math.round(size * 0.775);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let c = teal;
			if (y >= y0 && y < y1) {
				const f = (x - areaX0) / areaW;
				if (f >= 0 && f <= 1 && BARS.some(([a, b]) => f >= a && f < b)) c = white;
			}
			const i = (y * size + x) * 3;
			px[i] = c[0];
			px[i + 1] = c[1];
			px[i + 2] = c[2];
		}
	}
	return png(size, size, px);
}

const outDir = path.resolve('static/icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), icon(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), icon(512));

// favicon.ico = 32x32 PNG wrapped in an ICO container (accepted by all modern browsers)
function ico(pngBuf) {
	const head = Buffer.alloc(6); // ICONDIR: reserved, type=1 (icon), count=1
	head.writeUInt16LE(1, 2);
	head.writeUInt16LE(1, 4);
	const entry = Buffer.alloc(16); // ICONDIRENTRY: w/h, planes@4, bpp@6, size@8, offset@12
	entry[0] = 32;
	entry[1] = 32;
	entry.writeUInt16LE(1, 4); // planes
	entry.writeUInt16LE(32, 6); // bpp
	entry.writeUInt32LE(pngBuf.length, 8);
	entry.writeUInt32LE(22, 12);
	return Buffer.concat([head, entry, pngBuf]);
}
fs.writeFileSync(path.resolve('static/favicon.ico'), ico(icon(32)));
console.log('wrote static/icons/icon-192.png, icon-512.png and static/favicon.ico');
