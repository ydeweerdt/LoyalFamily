import { test, expect } from '@playwright/test';
import { addCard, login } from './helpers';

/** Golden flow 3: work fully offline → queued change syncs on reconnect. */
test('offline add is queued, applied optimistically and syncs on reconnect', async ({ page, context }) => {
	await login(page, 'papa', 'pass12345');

	// warm the app shell for the /add route while still online
	await page.getByTitle('Add card').click();
	await expect(page.getByPlaceholder('Search brand or store…')).toBeVisible();

	// go offline — the UI already works from the cached shell + IndexedDB
	await context.setOffline(true);
	await page.getByRole('link', { name: 'LoyalFamily' }).click(); // client-side nav, no network needed

	await addCard(page, 'lidl', 'Lidl Plus', {
		barcode_value: '1234567890128', // offline entry, EAN-13-shaped
		symbology: 'EAN_13',
		comment: 'added in the metro'
	});

	// optimistic local state: tile is there, banner counts the queued op
	await expect(page.locator('.tile', { hasText: 'Lidl Plus' })).toBeVisible();
	await expect(page.locator('.offline')).toContainText('1 change');

	// reconnect: the 'online' event flushes the queue and a full pull reconciles
	await context.setOffline(false);
	await expect(page.locator('.offline')).toBeHidden({ timeout: 15_000 });

	// server truth: the card exists with the right owner and value
	const { cards } = await (await page.request.get('/api/cards')).json();
	const synced = cards.find((c: { comment: string }) => c.comment === 'added in the metro');
	expect(synced).toBeTruthy();
	expect(synced.barcode_value).toBe('1234567890128');
});
