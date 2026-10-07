import { test, expect } from '@playwright/test';

/**
 * PWA install criteria, verified against the built app at runtime:
 * manifest + icons served, service worker registers AND controls the page,
 * and a cold navigation while offline is served from the SW shell cache —
 * which is exactly what an installed (standalone) launch does.
 * The browser's install *heuristics* (beforeinstallprompt, "Add to Home
 * Screen") need a real device; the criteria they check are verified here.
 */
test('PWA is installable: manifest, icons, SW control, offline cold launch', async ({ page, context }) => {
	// manifest is served and parseable with install-required fields
	const mf = await page.request.get('/manifest.json');
	expect(mf.ok()).toBe(true);
	const manifest = await mf.json();
	expect(manifest.display).toBe('standalone');
	expect(manifest.start_url).toBe('/');
	const sizes = (manifest.icons as { sizes: string }[]).map((i) => i.sizes);
	expect(sizes).toContain('192x192');
	expect(sizes).toContain('512x512');

	// icons are actually served
	for (const src of ['/icons/icon-192.png', '/icons/icon-512.png', '/favicon.ico']) {
		expect((await page.request.get(src)).status()).toBe(200);
	}

	// the service worker registers and takes control of the page
	await page.goto('/');
	const controlled = await page.evaluate(async () => {
		const reg = await navigator.serviceWorker.ready;
		if (!reg.active) return false;
		if (navigator.serviceWorker.controller) return true;
		// sw.js calls clients.claim() on activate; give it a beat
		await new Promise((r) => setTimeout(r, 1000));
		return navigator.serviceWorker.controller != null;
	});
	expect(controlled).toBe(true);

	// offline cold launch: the shell itself must come from the SW cache
	await context.setOffline(true);
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'LoyalFamily' })).toBeVisible();
	await context.setOffline(false);
});
