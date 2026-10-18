import { test, expect } from '@playwright/test';
import { JSDOM } from 'jsdom';
import JsBarcode from 'jsbarcode';
import { login } from './helpers';

/**
 * End-to-end scan through the ZXing fallback (headless Chromium has no
 * BarcodeDetector, so this is the same path a phone without the native
 * detector takes): a canvas MediaStream shows a real EAN-13 and the scanner
 * must read it into the form.
 */
function ean13Svg(): string {
	const doc = new JSDOM('<svg id="s"></svg>').window.document;
	const svg = doc.getElementById('s')!;
	JsBarcode(svg, '540123456789', { format: 'ean13', width: 4, height: 200, margin: 20, displayValue: false, xmlDocument: doc });
	return svg.outerHTML;
}

test('camera scan reads an EAN-13 into the add-card form', async ({ page }) => {
	const svg = ean13Svg();
	await page.addInitScript(({ svg }: { svg: string }) => {
		let release: (s: MediaStream) => void;
		const stream = new Promise<MediaStream>((res) => (release = res));
		const nav = window.navigator as any;
		nav.mediaDevices = nav.mediaDevices || {};
		nav.mediaDevices.getUserMedia = () => stream;
		const img = new Image();
		img.onload = () => {
			const c = document.createElement('canvas');
			c.width = 800;
			c.height = 600;
			const ctx = c.getContext('2d')!;
			const draw = () => {
				ctx.fillStyle = '#fff';
				ctx.fillRect(0, 0, 800, 600);
				ctx.drawImage(img, 40, 100, 720, 400);
			};
			draw();
			setInterval(draw, 100); // captureStream only advances while the canvas is redrawn
			release(c.captureStream(15));
		};
		img.src = 'data:image/svg+xml;base64,' + btoa(svg);
	}, { svg });

	await login(page, 'papa', 'pass12345');
	await page.getByTitle('Add card').click();
	await page.getByPlaceholder('Search brand or store…').fill('carrefour');
	await page.getByRole('button', { name: 'Carrefour', exact: false }).click();

	await expect(page.getByRole('dialog', { name: 'Scan barcode' })).toBeVisible();
	await expect(page.locator('input[name="barcode_value"]')).toHaveValue('5401234567898', { timeout: 40_000 });
});
