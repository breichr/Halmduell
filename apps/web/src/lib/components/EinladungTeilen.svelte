<script lang="ts">
	import { page } from '$app/state';

	let { code }: { code: string } = $props();

	const link = $derived(`${page.url.origin}/einladung/${code}`);
	let kopiert = $state(false);
	const kannTeilen = typeof navigator !== 'undefined' && 'share' in navigator;

	async function teilen() {
		try {
			await navigator.share({ title: 'Halmduell', text: 'Ich fordere dich zum Halmduell heraus!', url: link });
		} catch {
			// abgebrochen – nichts zu tun
		}
	}

	async function kopieren() {
		try {
			await navigator.clipboard.writeText(link);
			kopiert = true;
			setTimeout(() => (kopiert = false), 2000);
		} catch {
			// Zwischenablage nicht verfügbar – Link bleibt markierbar
		}
	}
</script>

<div class="karte einladung">
	<h2>Gegner einladen</h2>
	<p class="hinweis">Schick diesen Link – wer ihn als Erstes öffnet, spielt gegen dich. Die Einladung verfällt nach 7 Tagen.</p>
	<p class="link" data-testid="einladungslink">{link}</p>
	<div class="aktionen">
		{#if kannTeilen}<button type="button" class="knopf" onclick={teilen}>Teilen</button>{/if}
		<button type="button" class="knopf zweitrangig" onclick={kopieren}>{kopiert ? 'Kopiert ✓' : 'Link kopieren'}</button>
	</div>
</div>

<style>
	.einladung {
		display: grid;
		gap: 0.7rem;
		background: var(--weizen-hell);
		box-shadow: none;
		border: 1.5px dashed var(--weizen);
	}
	h2,
	p {
		margin: 0;
	}
	.link {
		font-family: ui-monospace, Menlo, monospace;
		font-size: 0.9rem;
		word-break: break-all;
		user-select: all;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
	.aktionen .knopf {
		flex: 1;
	}
</style>
