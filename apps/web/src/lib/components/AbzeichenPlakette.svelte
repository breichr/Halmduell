<script lang="ts">
	import type { AbzeichenIcon } from '@halmduell/shared';

	let { icon, erreicht = true, groesse = 56 }: { icon: AbzeichenIcon; erreicht?: boolean; groesse?: number } = $props();

	// Grundfarbe der Plakette je Symbol (Text/Striche darauf immer dunkel)
	const FARBE: Record<AbzeichenIcon, string> = {
		halm: 'var(--hellgruen)',
		garbe: 'var(--sonne)',
		scheune: 'var(--orange)',
		aehre: 'var(--sonne)',
		kulturen: 'var(--hellgruen)',
		schaedlinge: 'var(--orange)',
		krankheiten: 'var(--blau)',
		wissen: 'var(--sonne)',
		pokal: 'var(--sonne)',
		krone: 'var(--sonne)',
		blitz: 'var(--blau)',
		flamme: 'var(--orange)',
		freunde: 'var(--hellgruen)',
		stern: 'var(--sonne)'
	};
</script>

<span class="plakette" class:gesperrt={!erreicht} style="--farbe: {FARBE[icon]}; --groesse: {groesse}px" aria-hidden="true">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
		{#if icon === 'halm'}
			<path d="M12 21V6" /><path d="M12 10c-2.5 0-4-1.6-4-4 2.5 0 4 1.6 4 4zM12 8c2.5 0 4-1.6 4-4-2.5 0-4 1.6-4 4zM12 14c-2.5 0-4-1.4-4-3.4 2.5 0 4 1.3 4 3.4z" />
		{:else if icon === 'garbe'}
			<path d="M8 21l4-10 4 10M12 21V11" /><path d="M7 14h10" /><path d="M12 11c-1-3-3-5-5-6M12 11c1-3 3-5 5-6M12 11V3" />
		{:else if icon === 'scheune'}
			<path d="M3 10 12 4l9 6v10H3z" /><path d="M9 20v-6h6v6M9 14l6 6M15 14l-6 6" />
		{:else if icon === 'aehre'}
			<path d="M12 22V9" /><path d="M12 9c-1.6-.6-2.5-2-2.5-3.6C11 5.8 12 7 12 9zm0 0c1.6-.6 2.5-2 2.5-3.6C13 5.8 12 7 12 9zM12 13c-1.8-.6-3-2-3-3.8 1.8.4 3 1.8 3 3.8zm0 0c1.8-.6 3-2 3-3.8-1.8.4-3 1.8-3 3.8zM12 17c-2-.6-3.3-2-3.3-4 2 .4 3.3 1.9 3.3 4zm0 0c2-.6 3.3-2 3.3-4-2 .4-3.3 1.9-3.3 4zM12 4.5V2" />
		{:else if icon === 'kulturen'}
			<path d="M12 21V8" /><path d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5zM12 9c3 0 5-2 5-5-3 0-5 2-5 5zM12 16c-3 0-5-2-5-4 3 0 5 1.5 5 4zM12 14c3 0 5-2 5-4-3 0-5 1.5-5 4z" />
		{:else if icon === 'schaedlinge'}
			<ellipse cx="12" cy="14" rx="4" ry="5.5" /><circle cx="12" cy="7" r="2" /><path d="M12 9v10M8 11 4 9M8 14H3.5M8 17l-4 2M16 11l4-2M16 14h4.5M16 17l4 2" />
		{:else if icon === 'krankheiten'}
			<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z" /><path d="M5 19 13 11" /><circle cx="14" cy="9" r="1" /><circle cx="10" cy="14" r="1" />
		{:else if icon === 'wissen'}
			<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z" /><path d="M12 6v13.5" />
		{:else if icon === 'pokal'}
			<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
		{:else if icon === 'krone'}
			<path d="M3 18 4.5 7l4.5 5 3-7 3 7 4.5-5L21 18z" /><path d="M3 21h18" />
		{:else if icon === 'blitz'}
			<path d="M13 2 5 13h6l-1 9 8-11h-6z" />
		{:else if icon === 'flamme'}
			<path d="M12 22c-4 0-7-2.8-7-6.6C5 11 9 9 9 4c3 1.5 4 4 4 6 1-.8 1.5-2 1.5-3.2C17.5 9 19 12 19 15.4 19 19.2 16 22 12 22z" /><path d="M12 22c-1.8 0-3-1.3-3-3 0-2 2-3 2-5 1.8 1 4 3 4 5 0 1.7-1.2 3-3 3z" />
		{:else if icon === 'freunde'}
			<circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.1.7 3.5 2.7 3.5 5.7" />
		{:else if icon === 'stern'}
			<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
		{/if}
	</svg>
	{#if !erreicht}
		<span class="schloss">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
		</span>
	{/if}
</span>

<style>
	.plakette {
		position: relative;
		flex: none;
		display: grid;
		place-items: center;
		width: var(--groesse);
		height: var(--groesse);
		border-radius: 50%;
		background: var(--farbe);
		color: #2a1c14;
		border: 3px solid var(--kontur);
		box-shadow: inset 0 0 0 3px rgb(255 255 255 / 0.45);
	}
	.plakette > svg {
		width: 58%;
		height: 58%;
	}
	.gesperrt {
		background: var(--grund);
		color: var(--text-2);
		border-style: dashed;
		border-color: var(--text-2);
		box-shadow: none;
		opacity: 0.75;
	}
	.schloss {
		position: absolute;
		right: -4px;
		bottom: -4px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--flaeche);
		border: 2px solid var(--text-2);
		color: var(--text-2);
	}
	.schloss svg {
		width: 12px;
		height: 12px;
	}
</style>
