import { test, expect } from '@playwright/test';
import { openMenu } from './helpers';

/** Golden flow 1: empty server → first admin → invite link → member joins. */
test('first registered user becomes admin; others need an invite', async ({ browser }) => {
	const adminPage = await browser.newPage();

	// register the first (admin) account
	await adminPage.goto('/');
	await adminPage.getByRole('link', { name: 'Register', exact: true }).click();
	await adminPage.fill('input[name="username"]', 'papa');
	await adminPage.fill('input[name="display_name"]', 'Papa');
	await adminPage.fill('input[name="password"]', 'pass12345');
	await adminPage.getByRole('button', { name: 'Register as first admin' }).click();
	await expect(adminPage.getByRole('button', { name: 'Menu' })).toBeVisible();

	// registration is now closed for everyone else
	const stranger = await browser.newPage();
	await stranger.goto('/register');
	await stranger.fill('input[name="username"]', 'sneaky');
	await stranger.fill('input[name="display_name"]', 'Sneaky');
	await stranger.fill('input[name="password"]', 'pass12345');
	await stranger.getByRole('button', { name: 'Register as first admin' }).click();
	await expect(stranger.getByText('registration is closed')).toBeVisible();
	await stranger.close();

	// admin creates a one-time invite link
	await openMenu(adminPage);
	await adminPage.getByRole('link', { name: 'Admin' }).click();
	await adminPage.getByRole('button', { name: 'Create invite link' }).click();
	const inviteUrl = await adminPage.locator('.invite code').textContent();
	expect(inviteUrl).toMatch(/\/join\/[0-9a-f]{32,64}$/);

	// member joins through the link (fresh context = fresh person)
	const memberPage = await browser.newPage();
	await memberPage.goto(inviteUrl!);
	await memberPage.getByLabel('Username').fill('mama');
	await memberPage.getByLabel('Display name').fill('Mama');
	await memberPage.getByLabel('Password').fill('pass12345');
	await memberPage.getByRole('button', { name: 'Join' }).click();
	await expect(memberPage.getByRole('button', { name: 'Menu' })).toBeVisible();
	// members don't get the admin nav
	await openMenu(memberPage);
	await expect(memberPage.getByRole('link', { name: 'Settings' })).toBeVisible();
	await expect(memberPage.getByRole('link', { name: 'Admin' })).toBeHidden();
	await memberPage.keyboard.press('Escape');

	// admin sees the new member in the people list (reload: the page was mounted before the join)
	await adminPage.reload();
	await openMenu(adminPage);
	await adminPage.getByRole('link', { name: 'Admin' }).click();
	await expect(adminPage.getByRole('cell', { name: 'mama', exact: true })).toBeVisible();

	// the invite link is single-use
	const reuse = await browser.newPage();
	await reuse.goto(inviteUrl!);
	await reuse.getByLabel('Username').fill('third');
	await reuse.getByLabel('Display name').fill('Third');
	await reuse.getByLabel('Password').fill('pass12345');
	await reuse.getByRole('button', { name: 'Join' }).click();
	await expect(reuse.getByText(/used|invalid|expired/i)).toBeVisible();
	await reuse.close();
});
