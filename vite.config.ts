import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib')
		}
	},
	test: {
		include: ['tests/**/*.test.ts'],
		env: {
			DATA_DIR: ':memory:',
			COOKIE_SECRET: 'test-secret-0000000000000000000000000000'
		}
	}
});
