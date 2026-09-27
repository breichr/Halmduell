<script lang="ts">
	let { code, username, weiter }: { code: string; username: string; weiter: () => void } = $props();

	let kopiert = $state(false);
	let bestaetigt = $state(false);

	async function kopieren() {
		try {
			await navigator.clipboard.writeText(code);
			kopiert = true;
			setTimeout(() => (kopiert = false), 2000);
		} catch {
			// Zwischenablage nicht verfügbar – Code bleibt markierbar
		}
	}

	function herunterladen() {
		const inhalt = `Halmduell – Wiederherstellungscode\n\nBenutzername: ${username}\nCode: ${code}\n\nMit diesem Code kannst du dein Passwort zurücksetzen, falls du es vergisst.\n`;
		const url = URL.createObjectURL(new Blob([inhalt], { type: 'text/plain;charset=utf-8' }));
		const a = Object.assign(document.createElement('a'), { href: url, download: `halmduell-${username}-wiederherstellung.txt` });
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="karte code-karte">
	<h2>Dein Wiederherstellungscode</h2>
	<p>
		Falls du dein Passwort vergisst, kannst du es nur mit diesem Code zurücksetzen. Er wird
		<strong>nur jetzt</strong> angezeigt – speichere ihn gut.
	</p>
	<p class="code" data-testid="wiederherstellungscode">{code}</p>
	<div class="aktionen">
		<button type="button" class="knopf zweitrangig klein" onclick={kopieren}>{kopiert ? 'Kopiert ✓' : 'Kopieren'}</button>
		<button type="button" class="knopf zweitrangig klein" onclick={herunterladen}>Als Datei speichern</button>
	</div>
	<label class="bestaetigung">
		<input type="checkbox" bind:checked={bestaetigt} />
		Ich habe den Code gespeichert
	</label>
	<button type="button" class="knopf breit" disabled={!bestaetigt} onclick={weiter}>Weiter</button>
</div>

<style>
	.code-karte {
		display: grid;
		gap: 0.9rem;
		border-bottom-width: 6px;
	}
	.code-karte h2,
	.code-karte p {
		margin: 0;
	}
	.code {
		font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-align: center;
		padding: 0.9rem;
		background: var(--sonne-hell);
		border: 3px dashed var(--kante);
		border-radius: var(--radius-klein);
		user-select: all;
		word-break: break-all;
	}
	.aktionen {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}
	.bestaetigung {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 44px;
		font-weight: 800;
	}
	.bestaetigung input {
		width: 1.4rem;
		height: 1.4rem;
		accent-color: var(--gruen);
	}
</style>
