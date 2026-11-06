<script lang="ts">
	import { enhance } from '$app/forms';
	import { betragFeld } from '#lib/format.ts';
	import { mitRueckmeldung } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const p = $derived(data.person);
	const fehler = $derived((form?.fehler ?? {}) as Record<string, string>);
	const fehlerIn = (bereich: string) => (form?.bereich === bereich ? fehler : {});
</script>

<svelte:head><title>Über dich · Fixkosten</title></svelte:head>

<a class="zurueck" href="/einstellungen"><span aria-hidden="true">‹</span> Einstellungen</a>
<h1>Über dich</h1>
<p class="lead">Name, Netto, Tag der Daueraufträge und Puffer.</p>

<form method="POST" action="?/profil" use:enhance={mitRueckmeldung()} class="section">
	<div class="card">
		{#each [
			{ id: 'name', label: 'Dein Name', wert: p.name, modus: 'text', hilfe: '' },
			{ id: 'netto', label: 'Nettogehalt pro Monat', wert: betragFeld(p.nettoCent), modus: 'decimal', hilfe: 'In Euro, zum Beispiel 3450' },
			{ id: 'tag', label: 'Tag der Daueraufträge', wert: String(p.ueberweisungstag), modus: 'numeric', hilfe: 'An diesem Tag gehen alle Überweisungen vom Gehaltskonto raus.' },
			{ id: 'puffer', label: 'Puffer, bevor die App „übrig“ meldet', wert: betragFeld(p.pufferCent), modus: 'decimal', hilfe: 'Bis zu diesem Betrag über dem Soll gilt alles als im Plan.' }
		] as feld (feld.id)}
			{@const f = fehlerIn('profil')[feld.id]}
			<div class="field">
				<label for="e-{feld.id}">{feld.label}</label>
				<input id="e-{feld.id}" name={feld.id} value={feld.wert} inputmode={feld.modus as 'text'} aria-invalid={!!f}
					aria-describedby={f || feld.hilfe ? `e-${feld.id}-h` : undefined} />
				{#if f}<span class="error" id="e-{feld.id}-h">{f}</span>{:else if feld.hilfe}<span class="help" id="e-{feld.id}-h">{feld.hilfe}</span>{/if}
			</div>
		{/each}
		<div class="field"><button class="primary" type="submit">Speichern</button></div>
	</div>
</form>
