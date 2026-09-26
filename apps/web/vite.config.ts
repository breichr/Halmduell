import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Node-Adapter: läuft als eigener Container auf Coolify (mit Bun)
			adapter: adapter()
		})
	]
	// /api/* wird in src/hooks.server.ts an die API weitergereicht (dev und Produktion)
});
