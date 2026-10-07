import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Server-down behaviour: the phone is online but the server is unreachable
 * (killed container → connection refused) or answers with a proxy 502.
 * In both cases the SW must serve the cached app shell, not an error page.
 * Runs its own server instance on a private port so it can kill it.
 */
const PORT = 4273;
const URL = `http://localhost:${PORT}`;

function startServer(args: string[]): ChildProcess {
	return spawn('node', args, {
		env: {
			...process.env,
			PORT: String(PORT),
			DATA_DIR: '/tmp/loyalfamily-e2e-down',
			COOKIE_SECRET: 'e2e-secret-0000000000000000000000000000'
		},
		stdio: 'ignore'
	});
}

test('server down (refused + 502) → app shell served from the service worker', async ({ browser }) => {
	let srv = startServer(['build/index.js']);
	await new Promise((r) => setTimeout(r, 2000));

	const page = await browser.newPage();
	await page.goto(URL); // registers SW + caches the shell
	await page.evaluate(() => navigator.serviceWorker.ready);
	await page.reload(); // ensure the SW controls this page
	await expect(page.getByRole('heading', { name: 'LoyalFamily' })).toBeVisible();

	// case 1: container killed → connection refused (deep route: what an
	// installed app opens when it restores its last URL)
	srv.kill();
	await new Promise((r) => setTimeout(r, 500));
	await page.goto(URL + '/settings');
	await expect(page.locator('nav')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

	// case 2: proxy up but backend down → 502 Bad Gateway
	const fake = startServer([
		'-e',
		`require('http').createServer((q,s)=>{s.writeHead(502,{'content-type':'text/html'});s.end('<h1>Bad Gateway</h1>')}).listen(${PORT})`
	]);
	await new Promise((r) => setTimeout(r, 1000));
	await page.goto(URL + '/');
	await expect(page.getByRole('heading', { name: 'LoyalFamily' })).toBeVisible();
	await expect(page.getByText('Bad Gateway')).toBeHidden();

	fake.kill();
	await page.close();
});
