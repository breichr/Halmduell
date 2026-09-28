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

	// Farben der Figur – fest, unabhängig vom Theme
	const K = '#2A1C14'; // Kontur
	const GRUEN = '#62C46A';
	const DUNKEL = '#3E9B4F';
	const HELL = '#A8E0A0';
	const TIEF = '#2F7D3B'; // Gliedmaßen auf der abgewandten Seite

	const augen = $derived(
		pose === 'jubeln' ? 'froh' : pose === 'schlafen' ? 'zu' : pose === 'traurig' ? 'traurig' : pose === 'denken' ? 'oben' : 'offen'
	);
	const mund = $derived(pose === 'winken' ? 'lacht' : pose === 'jubeln' ? 'grinst' : pose === 'traurig' ? 'traurig' : pose === 'denken' ? 'schief' : 'o');
	const fuehlerHaengen = $derived(pose === 'traurig' || pose === 'schlafen');
	// Arm (Vorderbein), das gestikuliert – je Pose ein Pfad vom Schultergelenk aus, dazu die Hand
	const arm = $derived.by((): { d: string; hand: [number, number] } => {
		switch (pose) {
			case 'winken':
				return { d: 'M76 82 Q94 84 101 68', hand: [102, 65] };
			case 'jubeln':
				return { d: 'M78 82 Q102 78 107 54', hand: [107, 51] };
			case 'lupe':
				return { d: 'M76 84 Q88 94 97 92', hand: [98, 91] };
			case 'denken':
				return { d: 'M76 84 Q92 94 91 81', hand: [90, 79] };
			default:
				return { d: 'M76 84 Q80 94 82 101', hand: [82, 102] };
		}
	});
</script>

<!-- Gliedmaße mit Kontur: dunkler, breiter Strich darunter, farbiger darüber -->
{#snippet glied(d: string, breite: number, farbe = DUNKEL)}
	<path {d} stroke={K} stroke-width={breite + 2.6} fill="none" stroke-linecap="round" stroke-linejoin="round" />
	<path {d} stroke={farbe} stroke-width={breite} fill="none" stroke-linecap="round" stroke-linejoin="round" />
{/snippet}

<!-- Halmi, der Grashüpfer auf dem Halm -->
<svg class="halmi {pose}" width={groesse} height={Math.round((groesse * 130) / 120)} viewBox="0 0 120 130" role="img" aria-label={beschreibung[pose]}>
	{#if halm}
		<!-- Halm mit Ähre und Blatt, auf dem Halmi sitzt -->
		{@render glied('M20 130 C22 100 25 64 30 30', 4, '#D9A93A')}
		<g fill="#E8BC45" stroke={K} stroke-width="1.6">
			{#each [[25, 30, -28], [35, 28, 28], [26, 20, -28], [35, 18, 28], [28, 10, -20], [34, 9, 20]] as [x, y, w] (`${x}-${y}`)}
				<ellipse cx={x} cy={y} rx="3.4" ry="6.2" transform="rotate({w} {x} {y})" />
			{/each}
		</g>
		<path d="M31 4 L31 -2 M26 6 L23 0 M36 6 L39 0" stroke={K} stroke-width="1.4" stroke-linecap="round" />
		<path d="M22 104 C44 94 82 96 108 108 C82 104 46 104 22 110 Z" fill="#9CCB55" stroke={K} stroke-width="2" stroke-linejoin="round" />
		<path d="M30 105 C52 100 76 101 98 105" stroke="#7DAE3C" stroke-width="1.4" fill="none" stroke-linecap="round" />
	{/if}

	{#if pose === 'jubeln'}
		<g class="sterne" fill="#FFC93C" stroke={K} stroke-width="1.4" stroke-linejoin="round">
			<path d="M7 74 l3 -8 3 8 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5z" />
			<path d="M108 12 l2 -5 2 5 5 .5 -4 3.5 1.5 5 -4.5 -3 -4.5 3 1.5 -5 -4 -3.5z" />
			<path d="M58 22 l1.6 -4 1.6 4 4 .4 -3 2.8 1 4 -3.6 -2.4 -3.6 2.4 1 -4 -3 -2.8z" />
		</g>
	{/if}

	<g class="figur">
		<!-- hinteres Sprungbein (fernere Seite): versetzt und dunkler, hinter dem Körper -->
		<g transform="translate(9 -3)">
			{@render glied('M38 63 L36 104 L43 106', 3, TIEF)}
			<path d="M58 93 C49 89 39 79 36 68 C34.5 61 40.5 58.5 44 63 C50 71 56 81 62 89 Z" fill={TIEF} stroke={K} stroke-width="2.2" stroke-linejoin="round" />
		</g>

		<!-- Körper mit Flügel -->
		<ellipse cx="62" cy="88" rx="21" ry="13" transform="rotate(-14 62 88)" fill={GRUEN} stroke={K} stroke-width="2.2" />
		<path d="M50 96 L51 100 M57 95 L58 99.5 M64 93.5 L65 98" stroke={DUNKEL} stroke-width="1.8" stroke-linecap="round" />
		<path d="M44 86 C52 74 70 69 82 71 C74 79 60 87 44 89 Z" fill={HELL} stroke={K} stroke-width="1.8" stroke-linejoin="round" />

		<!-- vorderes Sprungbein: kräftiger Schenkel am Körper, Unterschenkel zum Blatt -->
		{@render glied('M38 63 L35 102 L43 104', 3)}
		<path d="M58 93 C49 89 39 79 36 68 C34.5 61 40.5 58.5 44 63 C50 71 56 81 62 89 Z" fill={DUNKEL} stroke={K} stroke-width="2.2" stroke-linejoin="round" />
		<path d="M42 69 L47 67.5 M46 75 L51 73 M51 81 L55.5 79" stroke={HELL} stroke-width="1.6" stroke-linecap="round" />

		<!-- Beine, die auf dem Blatt stehen -->
		{@render glied('M60 98 L58 104', 2.6)}
		{@render glied('M70 96 L72 104', 2.6)}
		{#if pose === 'jubeln'}
			<!-- zweiter Arm hinter dem Kopf nach oben -->
			{@render glied('M72 80 Q60 68 64 50', 3)}
			<circle cx="64" cy="47" r="3.4" fill={GRUEN} stroke={K} stroke-width="1.8" />
		{/if}

		<!-- Fühler -->
		{#if fuehlerHaengen}
			{@render glied('M82 50 C76 44 68 46 64 54', 2)}
			{@render glied('M91 49 C98 42 106 46 110 56', 2)}
		{:else}
			{@render glied('M82 50 C78 38 72 30 64 26', 2)}
			{@render glied('M91 49 C94 36 100 28 110 26', 2)}
		{/if}

		<!-- Kopf -->
		<g class="kopf">
			<circle cx="86" cy="64" r="17" fill={GRUEN} stroke={K} stroke-width="2.2" />
			<ellipse cx="75.5" cy="71" rx="3.2" ry="2.2" fill="#F6A6A0" opacity="0.75" />
			<ellipse cx="97.5" cy="70" rx="3.2" ry="2.2" fill="#F6A6A0" opacity="0.75" />

			{#if augen === 'froh'}
				<path d="M76 62 Q80 56 84 62 M88 61 Q92 55 96 61" stroke={K} stroke-width="2.4" fill="none" stroke-linecap="round" />
			{:else if augen === 'zu'}
				<path d="M76 61 Q80 65 84 61 M88 60 Q92 64 96 60" stroke={K} stroke-width="2.4" fill="none" stroke-linecap="round" />
			{:else}
				<g class="augen">
					<circle cx="80" cy="61" r="5.4" fill="#FFFFFF" stroke={K} stroke-width="1.6" />
					<circle cx="92" cy="60" r="5.4" fill="#FFFFFF" stroke={K} stroke-width="1.6" />
					{#if augen === 'oben'}
						<circle cx="81.5" cy="58.5" r="2.7" fill={K} />
						<circle cx="93.5" cy="57.5" r="2.7" fill={K} />
					{:else if augen === 'traurig'}
						<circle cx="80" cy="63" r="2.7" fill={K} />
						<circle cx="92" cy="62" r="2.7" fill={K} />
					{:else}
						<circle cx="81" cy="61.5" r="2.8" fill={K} />
						<circle cx="93" cy="60.5" r="2.8" fill={K} />
						<circle cx="82" cy="60.3" r="0.9" fill="#FFFFFF" />
						<circle cx="94" cy="59.3" r="0.9" fill="#FFFFFF" />
					{/if}
				</g>
				{#if augen === 'traurig'}
					<path d="M75 55 L83 54.5 M89 53.5 L97 55" stroke={K} stroke-width="1.8" stroke-linecap="round" />
					<path d="M98.5 64 C97 67 96.5 69 98.5 70.5 C100.5 69 100 67 98.5 64 Z" fill="#7CCBF0" stroke={K} stroke-width="1" />
				{/if}
			{/if}

			{#if mund === 'lacht'}
				<path d="M81 71 Q86 76 91 71" stroke={K} stroke-width="2" fill="none" stroke-linecap="round" />
			{:else if mund === 'grinst'}
				<path d="M79.5 69.5 Q86 80 92.5 69.5 Z" fill="#8C2F2A" stroke={K} stroke-width="2" stroke-linejoin="round" />
				<path d="M82 74.5 Q86 72.5 90 74.5 Q86 78 82 74.5 Z" fill="#F08C84" />
			{:else if mund === 'traurig'}
				<path d="M81 75 Q86 70.5 91 75" stroke={K} stroke-width="2" fill="none" stroke-linecap="round" />
			{:else if mund === 'schief'}
				<path d="M82 73 Q86 74.5 90 71.5" stroke={K} stroke-width="2" fill="none" stroke-linecap="round" />
			{:else}
				<ellipse cx="86" cy="73" rx="2" ry="2.4" fill={K} />
			{/if}
		</g>

		<!-- gestikulierender Arm, Lupe -->
		<g class="arm">
			{@render glied(arm.d, 3)}
			<circle cx={arm.hand[0]} cy={arm.hand[1]} r="3.4" fill={GRUEN} stroke={K} stroke-width="1.8" />
		</g>
		{#if pose === 'lupe'}
			<path d="M100 90 L104 86" stroke={K} stroke-width="4.4" stroke-linecap="round" />
			<circle cx="109" cy="80" r="8.5" fill="#E8F6FF" fill-opacity="0.85" stroke={K} stroke-width="2.6" />
			<path d="M104.5 77 Q106.5 74 110 74.5" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" />
		{/if}
	</g>

	{#if pose === 'schlafen'}
		<g class="zzz" fill="currentColor" font-family="system-ui, sans-serif" font-weight="800">
			<text x="100" y="40" font-size="10">z</text>
			<text x="106" y="30" font-size="13">z</text>
			<text x="96" y="20" font-size="8">z</text>
		</g>
	{:else if pose === 'denken'}
		<text class="fragezeichen" x="104" y="48" font-size="18" font-weight="800" font-family="system-ui, sans-serif" fill="currentColor">?</text>
	{/if}
</svg>

<style>
	.halmi {
		display: block;
		flex: none;
		color: var(--text);
		overflow: visible;
	}
	.arm,
	.augen,
	.figur,
	.sterne path {
		transform-box: fill-box;
	}
	/* Winken: Arm pendelt um die Schulter (unten links im Arm) */
	.winken .arm {
		transform-origin: 0% 100%;
		animation: winken 1.4s ease-in-out 3;
	}
	/* Blinzeln, solange die Augen offen sind */
	.augen {
		transform-origin: 50% 50%;
		animation: blinzeln 5s infinite;
	}
	.jubeln .figur {
		transform-origin: 50% 100%;
		animation: huepfen 0.7s ease-in-out 3;
	}
	.sterne path {
		transform-origin: 50% 50%;
		animation: funkeln 1.6s ease-in-out infinite;
	}
	.sterne path:nth-child(2) {
		animation-delay: 0.5s;
	}
	.sterne path:nth-child(3) {
		animation-delay: 1s;
	}
	.zzz {
		animation: schweben 2.4s ease-in-out infinite;
	}
	@keyframes winken {
		50% {
			transform: rotate(-14deg);
		}
	}
	@keyframes blinzeln {
		0%,
		95%,
		100% {
			transform: scaleY(1);
		}
		97.5% {
			transform: scaleY(0.1);
		}
	}
	@keyframes huepfen {
		40% {
			transform: translateY(-5px);
		}
	}
	@keyframes funkeln {
		50% {
			transform: scale(0.75) rotate(12deg);
		}
	}
	@keyframes schweben {
		50% {
			transform: translateY(-3px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.arm,
		.augen,
		.figur,
		.sterne path,
		.zzz {
			animation: none;
		}
	}
</style>
