<script module lang="ts">
	export type HalmiPose = 'winken' | 'lupe' | 'jubeln' | 'traurig' | 'schlafen' | 'denken';
</script>

<script lang="ts">
	let {
		pose = 'winken',
		groesse = 120,
		halm = true
	}: { pose?: HalmiPose; groesse?: number; halm?: boolean } = $props();

	const beschreibung: Record<HalmiPose, string> = {
		winken: 'Halmi winkt',
		lupe: 'Halmi mit Lupe',
		jubeln: 'Halmi jubelt',
		traurig: 'Halmi ist traurig',
		schlafen: 'Halmi schläft',
		denken: 'Halmi denkt nach'
	};

	const augen = $derived(
		pose === 'jubeln' ? 'froh' : pose === 'schlafen' ? 'zu' : pose === 'traurig' ? 'traurig' : pose === 'denken' ? 'oben' : 'offen'
	);
	const mund = $derived(
		pose === 'winken' ? 'lacht' : pose === 'jubeln' ? 'grinst' : pose === 'traurig' ? 'traurig' : 'o'
	);
	const fuehlerHaengen = $derived(pose === 'traurig' || pose === 'schlafen');
</script>

<!-- Halmi, der Grashüpfer auf dem Halm. Farben fest (Figur), unabhängig vom Theme. -->
<svg class="halmi" width={groesse} height={Math.round((groesse * 130) / 120)} viewBox="0 0 120 130" role="img" aria-label={beschreibung[pose]}>
	{#if halm}
		<path d="M34 130 C36 100 40 70 48 18" stroke="#C99A2E" stroke-width="4" fill="none" stroke-linecap="round" />
		{#each [[44, 22, -25], [53, 20, 25], [42, 32, -25], [51, 30, 25], [40, 42, -25], [49, 40, 25]] as [x, y, w] (`${x}-${y}`)}
			<ellipse cx={x} cy={y} rx="3" ry="6" transform="rotate({w} {x} {y})" fill="#E3B43C" />
		{/each}
	{/if}

	{#if pose === 'jubeln'}
		<g fill="#FFC93C" stroke="#2A1C14" stroke-width="1.2" stroke-linejoin="round">
			<path d="M14 30 l3 -8 3 8 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5z" />
			<path d="M104 8 l2 -5 2 5 5 .5 -4 3.5 1.5 5 -4.5 -3 -4.5 3 1.5 -5 -4 -3.5z" />
		</g>
	{/if}

	<path d="M54 80 L80 52" stroke="#2F7D3B" stroke-width="9" stroke-linecap="round" />
	<path d="M80 52 L68 94" stroke="#2F7D3B" stroke-width="4" stroke-linecap="round" />
	<path d="M68 94 L77 96" stroke="#2F7D3B" stroke-width="4" stroke-linecap="round" />
	<ellipse cx="64" cy="82" rx="27" ry="12" transform="rotate(-18 64 82)" fill="#58B85F" />
	<path d="M50 84 L52 90 M58 80 L60 86 M66 77 L68 83" stroke="#3E9B4F" stroke-width="2" stroke-linecap="round" />
	<path d="M44 88 C58 72 78 66 88 68 C78 75 63 83 44 88 Z" fill="#9EDB9E" />
	<path d="M74 91 L72 102" stroke="#2F7D3B" stroke-width="3" stroke-linecap="round" />

	{#if pose === 'winken' || pose === 'jubeln'}
		<path d="M82 86 L96 80 L104 66" stroke="#2F7D3B" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
		<path d="M100 60 Q104 56 108 60 M110 66 Q114 64 114 69" stroke="#2F7D3B" stroke-width="1.6" fill="none" stroke-linecap="round" />
	{/if}
	{#if pose === 'jubeln'}
		<path d="M76 80 L70 60 L74 50" stroke="#2F7D3B" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
	{/if}
	{#if pose === 'lupe'}
		<path d="M82 86 L94 94" stroke="#2F7D3B" stroke-width="3" stroke-linecap="round" />
		<path d="M94 94 L99 100" stroke="#2A1C14" stroke-width="4" stroke-linecap="round" />
		<circle cx="106" cy="92" r="10" fill="#E8F6FF" stroke="#2A1C14" stroke-width="3" />
		<path d="M101 88 Q104 85 108 86" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" />
	{/if}
	{#if pose === 'denken'}
		<path d="M82 86 Q96 90 96 80" stroke="#2F7D3B" stroke-width="3" fill="none" stroke-linecap="round" />
	{/if}
	{#if pose === 'traurig' || pose === 'schlafen'}
		<path d="M82 88 L84 100" stroke="#2F7D3B" stroke-width="3" stroke-linecap="round" />
	{/if}

	<circle cx="92" cy="66" r="13" fill="#62C46A" />
	<circle cx="86" cy="71" r="2.6" fill="#F6A6A0" opacity="0.7" />

	{#if augen === 'offen'}
		<circle cx="96" cy="62" r="6" fill="#FFFFFF" />
		<circle cx="97.5" cy="62.5" r="3" fill="#2A1C14" />
		<circle cx="98.5" cy="61.2" r="1" fill="#FFFFFF" />
	{:else if augen === 'oben'}
		<circle cx="96" cy="62" r="6" fill="#FFFFFF" />
		<circle cx="97.5" cy="59.8" r="3" fill="#2A1C14" />
	{:else if augen === 'froh'}
		<path d="M91 63 Q96 56 101 63" stroke="#2A1C14" stroke-width="2.4" fill="none" stroke-linecap="round" />
	{:else if augen === 'zu'}
		<path d="M91 62 Q96 66 101 62" stroke="#2A1C14" stroke-width="2.4" fill="none" stroke-linecap="round" />
	{:else}
		<circle cx="96" cy="63" r="6" fill="#FFFFFF" />
		<circle cx="96.5" cy="65" r="3" fill="#2A1C14" />
		<path d="M90 56 L101 58" stroke="#2A1C14" stroke-width="2" stroke-linecap="round" />
		<ellipse cx="101" cy="71" rx="1.8" ry="2.8" fill="#7CCBF0" />
	{/if}

	{#if mund === 'lacht'}
		<path d="M89 72 Q95 77 101 72" stroke="#2A1C14" stroke-width="2" fill="none" stroke-linecap="round" />
	{:else if mund === 'grinst'}
		<path d="M88 71 Q95 81 102 71 Z" stroke="#2A1C14" stroke-width="2" fill="#FFFFFF" stroke-linejoin="round" />
	{:else if mund === 'traurig'}
		<path d="M89 76 Q95 71 101 76" stroke="#2A1C14" stroke-width="2" fill="none" stroke-linecap="round" />
	{:else}
		<circle cx="95" cy="74" r="2.2" fill="#2A1C14" />
	{/if}

	{#if fuehlerHaengen}
		<path d="M94 54 C100 48 108 52 112 62" stroke="#2F7D3B" stroke-width="2.5" fill="none" stroke-linecap="round" />
		<path d="M88 54 C84 46 78 48 74 56" stroke="#2F7D3B" stroke-width="2.5" fill="none" stroke-linecap="round" />
	{:else}
		<path d="M94 54 C98 40 106 32 116 30" stroke="#2F7D3B" stroke-width="2.5" fill="none" stroke-linecap="round" />
		<path d="M88 54 C88 40 92 30 100 22" stroke="#2F7D3B" stroke-width="2.5" fill="none" stroke-linecap="round" />
	{/if}

	{#if pose === 'schlafen'}
		<g class="zzz" fill="currentColor" font-family="system-ui, sans-serif" font-weight="800">
			<text x="104" y="40" font-size="10">z</text>
			<text x="110" y="30" font-size="13">z</text>
			<text x="100" y="22" font-size="8">z</text>
		</g>
	{:else if pose === 'denken'}
		<text x="104" y="36" font-size="20" font-weight="800" font-family="system-ui, sans-serif" fill="currentColor">?</text>
	{/if}
</svg>

<style>
	.halmi {
		display: block;
		flex: none;
		color: var(--text);
	}
	.zzz {
		animation: schweben 2.4s ease-in-out infinite;
	}
	@keyframes schweben {
		50% {
			transform: translateY(-3px);
		}
	}
</style>
