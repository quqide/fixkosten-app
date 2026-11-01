import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	test: {
		projects: [
			{ extends: true, test: { name: 'server', include: ['src/**/*.test.ts'], exclude: ['src/lib/components/**'] } },
			{
				// Komponenten laufen mit der Browser-Version von Svelte in jsdom.
				extends: true,
				resolve: { conditions: ['browser'] },
				test: { name: 'komponenten', include: ['src/lib/components/**/*.test.ts'], environment: 'jsdom' }
			}
		]
	}
});
