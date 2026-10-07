import { test, expect } from '@playwright/test';
import { addCard, login } from './helpers';

// fake camera so the scan test can exercise the real getUserMedia path
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

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

test('stacked brand: tap opens tile view, tap tile shows barcode, hold opens edit', async ({ page }) => {
	await login(page, 'papa', 'pass12345');
	await addCard(page, 'delhaize', 'Delhaize', {
		barcode_value: '987654321098765432',
		symbology: 'CODE_128',
		comment: 'papa second'
	});

	// Delhaize now has 2 cards → count badge
	const tile = page.locator('.tile', { hasText: 'Delhaize' });
	await expect(tile.locator('.badge.count')).toHaveText('2');

	// tap → tile view of the stacked cards (not an edit dialog)
	await tile.click();
	const dialog = page.getByRole('dialog', { name: 'Delhaize' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('heading', { name: 'Edit card' })).toBeHidden();
	await expect(dialog.locator('.tile')).toHaveCount(2);

	// tap an inner tile → barcode full-screen
	await dialog.locator('.tile', { hasText: 'papa second' }).click();
	await expect(page.locator('.fullscreen')).toBeVisible();
	await page.keyboard.press('Escape');

	// hold an inner tile → edit dialog
	const inner = dialog.locator('.tile', { hasText: 'papa private' });
	await inner.dispatchEvent('pointerdown');
	await expect(page.getByRole('dialog', { name: 'Edit card' })).toBeVisible({ timeout: 2000 });
});

test('invalid EAN-13 check digit is flagged before saving', async ({ page }) => {
	await login(page, 'papa', 'pass12345');
	await page.getByTitle('Add card').click();
	await page.getByPlaceholder('Search brand or store…').fill('carrefour');
	await page.getByRole('button', { name: 'Carrefour', exact: false }).click();
	await page.getByRole('button', { name: 'Manual' }).click();
	await page.fill('input[name="barcode_value"]', '5401234567890'); // wrong check digit (…894 is valid)
	await page.selectOption('select[name="symbology"]', 'EAN_13');
	await expect(page.getByText('invalid EAN-13 check digit')).toBeVisible();
});

test('card form fields are off-limits to password managers', async ({ page }) => {
	await login(page, 'papa', 'pass12345');
	await page.getByTitle('Add card').click();
	await page.getByPlaceholder('Search brand or store…').fill('carrefour');
	await page.getByRole('button', { name: 'Carrefour', exact: false }).click();
	await page.getByRole('button', { name: 'Manual' }).click();
	const barcode = page.locator('input[name="barcode_value"]');
	await expect(barcode).toHaveAttribute('data-1p-ignore');
	await expect(barcode).toHaveAttribute('autocomplete', 'off');
	await expect(barcode).toHaveAttribute('inputmode', 'numeric');
});

test('scanning in the add flow prefills the card form', async ({ page }) => {
	await login(page, 'papa', 'pass12345');
	// fake camera is real (launch flags below); only the detector is stubbed
	await page.addInitScript(() => {
		(window as any).BarcodeDetector = class {
			async detect() {
				return [{ format: 'ean_13', rawValue: '5401234567894' }];
			}
		};
	});

	await page.goto('/add');
	await page.getByPlaceholder('Search brand or store…').fill('carrefour');
	await page.getByRole('button', { name: 'Carrefour', exact: false }).click();
	await expect(page.getByRole('dialog', { name: 'Scan barcode' })).toBeVisible();

	await expect(page.locator('input[name="barcode_value"]')).toHaveValue('5401234567894');
	await expect(page.locator('select[name="symbology"]')).toHaveValue('EAN_13');
});
