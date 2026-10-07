import { test, expect, type Page } from '@playwright/test';
import { login, openMenu } from './helpers';

/** Localization: phone-language auto-detection + Settings override (localStorage). */
test('language auto-detects and can be overridden to Dutch', async ({ page }) => {
	await page.goto('/');
	// Playwright browsers report en-US → English UI by default
	await expect(page.getByText('Your family loyalty cards')).toBeVisible();
	expect(await htmlLang(page)).toBe('en');

	// override to Dutch (what the Settings language picker does)
	await page.evaluate(() => localStorage.setItem('loyalfamily.lang', 'nl'));
	await page.reload();
	await expect(page.getByText('Jouw gezins-loyaliteitskaarten')).toBeVisible();
	await expect(page.getByRole('navigation').getByRole('link', { name: 'Aanmelden' })).toBeVisible();
	expect(await htmlLang(page)).toBe('nl');

	// back to auto
	await page.evaluate(() => localStorage.removeItem('loyalfamily.lang'));
	await page.reload();
	await expect(page.getByText('Your family loyalty cards')).toBeVisible();
	expect(await htmlLang(page)).toBe('en');
});

const htmlLang = (page: Page) => page.evaluate(() => document.documentElement.lang);

test('Settings language picker switches the whole UI', async ({ page }) => {
	await login(page, 'papa', 'pass12345');
	await openMenu(page);
	await page.getByRole('link', { name: 'Settings' }).click();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

	await page.getByRole('combobox').selectOption('nl');
	await expect(page.getByRole('heading', { name: 'Instellingen' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Taal' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Mijn kaarten exporteren (JSON)' })).toBeVisible();

	// persists across reloads
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Instellingen' })).toBeVisible();
	expect(await htmlLang(page)).toBe('nl');

	await page.getByRole('combobox').selectOption('auto');
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});
