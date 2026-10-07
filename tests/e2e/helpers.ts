import { expect, type Page } from '@playwright/test';

export async function login(page: Page, username: string, password: string): Promise<void> {
	await page.goto('/login');
	await page.fill('input[name="username"]', username);
	await page.fill('input[name="password"]', password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
}

/** Add a card through the brand picker (manual entry — no camera in headless). */
export async function addCard(
	page: Page,
	brandSearch: string,
	brandTile: string,
	values: { barcode_value: string; symbology: string; comment?: string; shared?: boolean }
): Promise<void> {
	await page.getByTitle('Add card').click();
	await page.getByPlaceholder('Search brand or store…').fill(brandSearch);
	await page.getByRole('button', { name: brandTile, exact: false }).click();
	await page.fill('input[name="barcode_value"]', values.barcode_value);
	await page.selectOption('select[name="symbology"]', values.symbology);
	if (values.comment) await page.fill('input[name="comment"]', values.comment);
	if (values.shared) await page.check('input[name="visibility"]');
	await page.getByRole('button', { name: 'Add card' }).click();
	await expect(page).toHaveURL(/\/$/);
}
