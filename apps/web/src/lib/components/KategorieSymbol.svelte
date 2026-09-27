<script lang="ts">
	import type { DuellKategorie } from '@halmduell/shared';

	let { kategorie, groesse = 28 }: { kategorie: DuellKategorie; groesse?: number } = $props();
</script>

<!-- Einfache Symbole je Kategorie (currentColor, passen sich dem Theme an) -->
<svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	{#if kategorie === 'kulturen'}
		<path d="M12 21V8" /><path d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5z" /><path d="M12 9c3 0 5-2 5-5-3 0-5 2-5 5z" /><path d="M12 16c-3 0-5-2-5-4 3 0 5 1.5 5 4z" /><path d="M12 14c3 0 5-2 5-4-3 0-5 1.5-5 4z" />
	{:else if kategorie === 'schaedlinge'}
		<ellipse cx="12" cy="14" rx="4" ry="5.5" /><circle cx="12" cy="7" r="2" /><path d="M12 9v10" /><path d="M8 11 4 9M8 14H3.5M8 17l-4 2M16 11l4-2M16 14h4.5M16 17l4 2M11 5 9.5 3M13 5l1.5-2" />
	{:else if kategorie === 'krankheiten'}
		<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15" /><circle cx="11" cy="13" r="1.3" /><circle cx="14.5" cy="9.5" r="1" /><circle cx="9" cy="16.5" r="0.9" />
	{:else if kategorie === 'wissen'}
		<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /><path d="M9 8h7M9 11.5h5" />
	{:else}
		<rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" />
	{/if}
</svg>
