import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	// SvelteKit 3: svelte.config.js is gone, config lives in the sveltekit() plugin
	plugins: [
		sveltekit({
			adapter: adapter(),
			preprocess: vitePreprocess(),
			// shortcut: kit 3 deprecated kit.alias in favour of #lib subpath imports;
			// switch the ~50 $lib imports when kit removes the option
			alias: { $lib: 'src/lib' }
		})
	],
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib')
		}
	},
	test: {
		include: ['tests/**/*.test.ts'],
		env: {
			DATA_DIR: ':memory:',
			COOKIE_SECRET: 'test-secret-00000000000000000000000000000000'
		}
	}
});
