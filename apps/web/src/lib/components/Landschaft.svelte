<script lang="ts">
	import type { Snippet } from 'svelte';

	let { hoehe = 240, nacht = false, children }: { hoehe?: number; nacht?: boolean; children?: Snippet } = $props();
</script>

<!-- Himmel mit Hügeln als Kopfbereich; Inhalt liegt darüber -->
<div class="landschaft" class:nacht style="min-height: {hoehe}px">
	<svg class="hintergrund" viewBox="0 0 390 240" preserveAspectRatio="none" aria-hidden="true">
		<path d="M0 176 C80 140 170 150 250 168 C310 182 350 170 390 156 L390 240 L0 240 Z" fill="var(--wiese-hell)" />
		<path d="M0 206 C90 180 200 186 290 200 C340 208 370 204 390 198 L390 240 L0 240 Z" fill="var(--wiese)" />
	</svg>
	<svg class="gestirn" width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
		<g class="sonne"><circle cx="30" cy="30" r="24" fill="#FFD95C" /></g>
		<g class="mond">
			<circle cx="30" cy="30" r="22" fill="#F4EBC6" />
			<circle cx="40" cy="24" r="20" fill="var(--himmel)" />
		</g>
	</svg>
	<div class="inhalt">
		{@render children?.()}
	</div>
</div>

<style>
	.landschaft {
		position: relative;
		background: var(--himmel);
		overflow: hidden;
		margin: 0 -1rem;
		padding: 0 1rem;
	}
	.hintergrund {
		position: absolute;
		left: 0;
		bottom: 0;
		width: 100%;
		height: 240px;
	}
	/* links neben der Avatar-Ecke oben rechts */
	.gestirn {
		position: absolute;
		right: 5.5rem;
		top: 0.6rem;
	}
	.mond {
		display: none;
	}
	.nacht .sonne {
		display: none;
	}
	.nacht .mond {
		display: inline;
	}
	@media (prefers-color-scheme: dark) {
		.sonne {
			display: none;
		}
		.mond {
			display: inline;
		}
	}
	.inhalt {
		position: relative;
	}
</style>
