<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { zeigeToast } from '#lib/toast.svelte.ts';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	/** Gewähltes Kontenmodell: 1 Spaßkonto mit festem Betrag, 2 eigenes Fixkosten-Konto. */
	let { modus }: { modus: number } = $props();

	const MODELLE = [
		{ wert: 1, titel: 'Spaßkonto mit festem Betrag', text: 'Fixkosten gehen direkt vom Gehaltskonto ab. Die App rechnet aus, wie viel aufs Spaßkonto darf.' },
		{ wert: 2, titel: 'Eigenes Fixkosten-Konto', text: 'Eine feste Monatsrate geht auf ein eigenes Konto. Der Rest auf dem Gehaltskonto ist frei.' }
	];

	const gewaehlt = $derived(MODELLE.find((m) => m.wert === modus) ?? MODELLE[0]);
	let offen = $state(false);
	let wahl = $state(1);
	let fehler = $state<string | undefined>();

	function oeffnen() {
		wahl = modus;
		fehler = undefined;
		offen = true;
	}

	const absenden: SubmitFunction = ({ cancel }) => {
		// Nichts geändert: nur schließen, damit kein leerer Eintrag im Verlauf landet.
		if (wahl === modus) {
			cancel();
			offen = false;
			return;
		}
		return async ({ result, update }) => {
			if (result.type === 'failure') {
				fehler = (result.data?.fehler as Record<string, string> | undefined)?.modus ?? 'Das hat nicht geklappt.';
				return;
			}
			if (result.type === 'error') {
				zeigeToast('Das hat nicht geklappt. Bitte versuch es noch einmal.');
				return;
			}
			await update({ reset: false, invalidateAll: true });
			const daten = result.type === 'success' ? (result.data as { meldung?: string; undoId?: number }) : undefined;
			if (daten?.meldung) zeigeToast(daten.meldung, daten.undoId ?? null);
			offen = false;
		};
	};
</script>

<button type="button" class="row" onclick={oeffnen}>
	<span class="main"><span class="title">{gewaehlt.titel}</span><span class="detail">{gewaehlt.text}</span></span>
	<span class="chev"><Icon name="pfeil" size={14} /></span>
</button>

<Sheet {offen} titel="Konten" formular="konten-formular" onabbrechen={() => (offen = false)}>
	<form id="konten-formular" method="POST" action="?/modus" use:enhance={absenden}>
		<div class="sheet-body">
			{#if fehler}<p class="note fehler" role="alert">{fehler}</p>{/if}
			<fieldset class="choice">
				<legend class="label">Wie sind deine Konten aufgebaut?</legend>
				{#each MODELLE as m (m.wert)}
					<label>
						<input type="radio" name="modus" value={m.wert} bind:group={wahl} />
						<strong>{m.titel}</strong><span>{m.text}</span>
					</label>
				{/each}
			</fieldset>
			<p class="note">Beim Wechsel passt die App deine Daueraufträge an. Du kannst es danach rückgängig machen.</p>
		</div>
	</form>
</Sheet>

<style>
	fieldset.choice { border: 0; margin: 0; padding: 0; min-width: 0; grid-template-columns: 1fr; }
	fieldset.choice legend { padding: 0 4px; margin-bottom: 8px; }
	.fehler { color: var(--warm); font-weight: 600; margin: 0 4px; }
</style>
