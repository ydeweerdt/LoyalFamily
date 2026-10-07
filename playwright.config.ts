import { defineConfig } from '@playwright/test';

/**
 * Golden flows (DESIGN §8):
 *   01 first-admin setup + invite → join
 *   02 add card (brand picker + manual entry) → barcode view
 *   03 offline edit → reconnect sync
 *   04 shared vs private visibility across users
 *
 * One fresh server per run (empty DB → the first-admin flow is honest),
 * serial execution: the specs tell one continuous story.
 * Runs in Docker (`make e2e`) on the official Playwright image.
 */
export default defineConfig({
	testDir: 'tests/e2e',
	fullParallel: false,
	workers: 1,
	reporter: [['list']],
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'retain-on-failure'
	},
	webServer: {
		command: 'sh -c "rm -rf /tmp/loyalfamily-e2e-data && node build/index.js"',
		env: {
			PORT: '4173',
			DATA_DIR: '/tmp/loyalfamily-e2e-data',
			COOKIE_SECRET: 'e2e-secret-0000000000000000000000000000',
			PUBLIC_URL: 'http://localhost:4173'
		},
		reuseExistingServer: false,
		timeout: 60_000
	}
});
