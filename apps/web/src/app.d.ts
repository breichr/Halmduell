import type { AngemeldeterUser } from '@halmduell/shared';

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface PageData {
			user?: AngemeldeterUser | null;
		}
	}
}

export {};
