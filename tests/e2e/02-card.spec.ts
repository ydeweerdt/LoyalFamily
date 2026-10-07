import { test, expect } from '@playwright/test';
import { addCard, login } from './helpers';

/** Golden flow 2: brand picker → manual entry → tile → full-screen barcode. */
test('add a card via brand picker and see its barcode full-screen', async ({ page }) => {
	await login(page, 'papa', 'pass12345');

	await addCard(page, 'delhaize', 'Delhaize', {
		barcode_value: '123456789012345678',
		symbology: 'CODE_128',
		comment: 'papa private'
	});

	// tile appears with the brand monogram/label (private → 🔒 on my own tile)
	const tile = page.locator('.tile', { hasText: 'Delhaize' });
	await expect(tile).toBeVisible();
	await expect(tile.locator('.badge.lock')).toBeVisible();

	// single-card tile: tap → barcode full-screen with a rendered SVG
	await tile.click();
	await expect(page.locator('.fullscreen')).toBeVisible();
	await expect(page.locator('.fullscreen svg')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('.fullscreen')).toBeHidden();
});

test('invalid EAN-13 check digit is flagged before saving', async ({ page }) => {
	await login(page, 'papa', 'pass12345');
	await page.getByTitle('Add card').click();
	await page.getByPlaceholder('Search brand or store…').fill('carrefour');
	await page.getByRole('button', { name: 'Carrefour', exact: false }).click();
	await page.fill('input[name="barcode_value"]', '5401234567890'); // wrong check digit (…894 is valid)
	await page.selectOption('select[name="symbology"]', 'EAN_13');
	await expect(page.getByText('invalid EAN-13 check digit')).toBeVisible();
});
