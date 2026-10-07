import { test, expect } from '@playwright/test';
import { addCard, login } from './helpers';

/** Golden flow 4: shared cards are visible to the family; private ones are invisible. */
test('shared vs private visibility across two family members', async ({ browser }) => {
	const papa = await browser.newPage();
	await login(papa, 'papa', 'pass12345');

	// one shared card, one private card
	await addCard(papa, 'kruidvat', 'Kruidvat', {
		barcode_value: '8712345678906',
		symbology: 'EAN_13',
		comment: 'family toothpaste',
		shared: true
	});
	await addCard(papa, 'action', 'Action', {
		barcode_value: '9876543210987',
		symbology: 'EAN_13',
		comment: 'papa secret'
	});

	// papa sees both; the private one carries the 🔒 badge, the shared one doesn't
	await expect(papa.locator('.tile', { hasText: 'Kruidvat' }).locator('.badge.lock')).toBeHidden();
	await expect(papa.locator('.tile', { hasText: 'Action' }).locator('.badge.lock')).toBeVisible();

	const mama = await browser.newPage();
	await login(mama, 'mama', 'pass12345');

	// mama sees the shared card (with its comment) and nothing of papa's private cards
	await expect(mama.locator('.tile', { hasText: 'Kruidvat' })).toBeVisible();
	await expect(mama.locator('.tile', { hasText: 'Action' })).toBeHidden();
	await expect(mama.locator('.tile', { hasText: 'Delhaize' })).toBeHidden(); // private from flow 02

	// enforced server-side too, not just hidden in the UI
	const { cards } = await (await mama.request.get('/api/cards')).json();
	const values = cards.map((c: { barcode_value: string }) => c.barcode_value);
	expect(values).toContain('8712345678906');
	expect(values).not.toContain('9876543210987');
	expect(values).not.toContain('123456789012345678');

	// mama cannot edit papa's shared card (owner-only editing)
	const res = await mama.request.put('/api/cards/' + cards.find((c: { brand_id: string }) => c.brand_id === 'kruidvat').id, {
		data: { name: 'hijacked' }
	});
	expect(res.status()).toBe(403);

	await papa.close();
	await mama.close();
});
