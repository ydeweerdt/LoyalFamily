import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

/**
 * PWA artifact regression: the manifest must stay valid and the icons real
 * (a broken manifest silently kills installability — easy to break by accident).
 */
describe('PWA artifacts', () => {
	it('manifest.json is valid and installable', () => {
		const manifest = JSON.parse(fs.readFileSync('static/manifest.json', 'utf8'));
		expect(manifest.name).toBe('LoyalFamily');
		expect(manifest.display).toBe('standalone');
		expect(manifest.start_url).toBe('/');
		expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
		for (const icon of manifest.icons) {
			expect(icon.sizes).toMatch(/^\d+x\d+$/);
			expect(fs.existsSync(pathJoin('static', icon.src))).toBe(true);
		}
	});

	it('icons are valid PNGs with the advertised dimensions', () => {
		for (const [file, size] of [
			['static/icons/icon-192.png', 192],
			['static/icons/icon-512.png', 512]
		] as const) {
			const buf = fs.readFileSync(file);
			expect(buf.subarray(0, 8)).toEqual(Buffer.from([137, 80, 71, 71, 13, 10, 26, 10]));
			const w = buf.readUInt32BE(16);
			const h = buf.readUInt32BE(20);
			expect([w, h]).toEqual([size, size]);
		}
	});

	it('service worker exists and implements the shell strategy', () => {
		const sw = fs.readFileSync('static/sw.js', 'utf8');
		expect(sw).toContain('fetch');
		expect(sw).toContain('navigate');
		// API must NOT be HTTP-cached — data freshness is the sync layer's job
		expect(sw).toContain("startsWith('/api/')");
	});

	it('app shell links the manifest', () => {
		const html = fs.readFileSync('src/app.html', 'utf8');
		expect(html).toContain('rel="manifest"');
	});

	it('favicon.ico is a valid PNG-in-ICO', () => {
		const buf = fs.readFileSync('static/favicon.ico');
		expect(buf.readUInt16LE(2)).toBe(1); // icon type
		expect(buf.readUInt16LE(4)).toBe(1); // one image
		expect(buf[6]).toBe(32); // width
		expect(buf[7]).toBe(32); // height
		expect(buf.subarray(22, 30)).toEqual(Buffer.from([137, 80, 71, 71, 13, 10, 26, 10])); // PNG signature
	});
});

function pathJoin(...parts: string[]): string {
	return parts.join('/');
}
