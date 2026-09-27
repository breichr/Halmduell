<script lang="ts">
	import type { DuellKategorie } from '@halmduell/shared';

	let { kategorie, groesse = 28 }: { kategorie: DuellKategorie; groesse?: number } = $props();
</script>

<!-- Einfache Symbole je Kategorie (currentColor, passen sich dem Theme an) -->
<svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	{#if kategorie === 'landtechnik'}
		<circle cx="7" cy="16" r="4" /><circle cx="18" cy="17" r="2.5" /><path d="M4 12V6h6l2 6h6l2 3v2" /><path d="M11 17h4.5" /><circle cx="7" cy="16" r="1" />
	{:else if kategorie === 'pflanzenbau'}
		<path d="M12 21V8" /><path d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5z" /><path d="M12 9c3 0 5-2 5-5-3 0-5 2-5 5z" /><path d="M12 16c-3 0-5-2-5-4 3 0 5 1.5 5 4z" /><path d="M12 14c3 0 5-2 5-4-3 0-5 1.5-5 4z" />
	{:else if kategorie === 'viehzucht'}
		<path d="M7 7 3 5.5C3 8 4.5 9.5 7 9.5M17 7l4-1.5C21 8 19.5 9.5 17 9.5" /><path d="M7 6.5c0-1.4 2.2-2.5 5-2.5s5 1.1 5 2.5V14H7z" /><path d="M7.5 14c-.8 1-1 2-1 3 0 2.2 2.4 4 5.5 4s5.5-1.8 5.5-4c0-1-.2-2-1-3z" /><circle cx="10" cy="17.5" r=".8" /><circle cx="14" cy="17.5" r=".8" /><circle cx="9.5" cy="10" r=".6" /><circle cx="14.5" cy="10" r=".6" />
	{:else}
		<rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" />
	{/if}
</svg>
