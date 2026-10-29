<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import PostenDialog from '#lib/components/PostenDialog.svelte';
	import PostenListe from '#lib/components/PostenListe.svelte';
	import { betragFeld, eur, eurGanz, initiale, zeitpunkt } from '#lib/format.ts';
	import type { FixkostenPosten } from '#lib/rechnung/fixkosten.ts';
	import { mitRueckmeldung } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let bearbeitet = $state<(FixkostenPosten & { id?: number }) | null>(null);
	let betraegeOffen = $state(false);
	const r = $derived(data.rechnung);
	const fehler = $derived((form?.fehler ?? {}) as Record<string, string>);
	const modelle = [
		{ wert: 'A', titel: 'Nach Gehalt', text: 'Wer mehr verdient, zahlt mehr.' },
		{ wert: 'B', titel: 'Gleicher Rest', text: 'Beiden bleibt nach der Überweisung gleich viel übrig.' }
	];
</script>

<svelte:head><title>Gemeinschaftskonto · Fixkosten</title></svelte:head>

<h1>Euer Gemeinschaftskonto</h1>
<p class="lead">Zusammen {eurGanz(r.gesamtCent)} im Monat, fair aufgeteilt.</p>

<div class="tiles">
	{#each data.personen as p, i (p.id)}
		<div class="card tile">
			<div class="k"><span class="avatar klein {p.id}">{p.name.charAt(0)}</span>{p.name} überweist</div>
			<div class="v">{eurGanz(r.anteile[i].betragCent)}</div>
			<div class="s">{Math.round(r.anteile[i].gehaltsanteil * 100)} % vom gemeinsamen Netto</div>
		</div>
	{/each}
</div>

<div class="section">
	<div class="section-head"><h2>Wie wollt ihr aufteilen?</h2></div>
	<form method="POST" action="?/modell" use:enhance={mitRueckmeldung()} class="choice">
		{#each modelle as m (m.wert)}
			<label>
				<input type="radio" name="modell" value={m.wert} checked={data.konto.modell === m.wert}
					onchange={(e) => e.currentTarget.form?.requestSubmit()} />
				<strong>{m.titel}</strong><span>{m.text}</span>
			</label>
		{/each}
		<noscript><button class="secondary" type="submit">Übernehmen</button></noscript>
	</form>
	<p class="note">Beide Beträge werden auf volle Euro aufgerundet. Der kleine Rest bleibt als Puffer auf dem Konto.</p>
</div>

<div class="section">
	<div class="section-head">
		<h2>Daraus setzt sich die Summe zusammen</h2>
		<button type="button" class="textlink" onclick={() => (betraegeOffen = !betraegeOffen)}>{betraegeOffen ? 'Fertig' : 'Ändern'}</button>
	</div>
	<div class="card">
		{#if betraegeOffen}
			<form method="POST" action="?/betraege" use:enhance={mitRueckmeldung(() => (betraegeOffen = false))}>
				{#each [['miete', 'Miete', data.konto.mieteCent, 'mieteCent'], ['alltag', 'Lebensmittel und Alltag für euch beide', data.konto.alltagCent, 'alltagCent'], ['ruecklage', 'Gemeinsame Rücklage aufs Tagesgeld', data.konto.ruecklageCent, 'ruecklageCent']] as [name, label, wert, key] (name)}
					<div class="field">
						<label for="g-{name}">{label}</label>
						<input id="g-{name}" name={String(name)} inputmode="decimal" value={betragFeld(Number(wert))} aria-invalid={!!fehler[String(key)]} />
						{#if fehler[String(key)]}<span class="error">{fehler[String(key)]}</span>{/if}
					</div>
				{/each}
				<div class="field"><button class="primary" type="submit">Beträge speichern</button></div>
			</form>
		{:else}
			<ul class="rows">
				<li><div class="row"><span class="icon a50">{initiale('Miete')}</span><span class="main"><span class="title">Miete</span></span><span class="value">{eur(data.konto.mieteCent)}</span></div></li>
				<li><div class="row"><span class="icon a50">L</span><span class="main"><span class="title">Lebensmittel und Alltag</span><span class="detail">für euch beide</span></span><span class="value">{eur(data.konto.alltagCent)}</span></div></li>
				<li><div class="row"><span class="icon a20">R</span><span class="main"><span class="title">Gemeinsame Rücklage</span><span class="detail">aufs Tagesgeld</span></span><span class="value">{eur(data.konto.ruecklageCent)}</span></div></li>
				<li><div class="row"><span class="icon a50">F</span><span class="main"><span class="title">Gemeinsame Fixkosten</span><span class="detail">aus der Liste unten, aufgerundet</span></span><span class="value">{eur(r.fixkostenCent)}</span></div></li>
				<li><div class="row total"><span class="main">Zusammen</span><span class="value">{eur(r.gesamtCent)}</span></div></li>
			</ul>
		{/if}
	</div>
</div>

<div class="section">
	<div class="section-head"><h2>Gemeinsame Fixkosten</h2></div>
	<div class="card">
		{#if data.eintraege.length}
			<PostenListe eintraege={data.eintraege} bearbeiten={(p) => (bearbeitet = p)} />
		{:else}
			<div class="empty"><p>Zum Beispiel Internet, Rundfunkbeitrag oder Hausratversicherung. Jahreszahlungen werden auf Monate verteilt.</p></div>
		{/if}
	</div>
	<div style="margin-top:14px">
		<button type="button" class="primary wide" onclick={() => (bearbeitet = { name: '', betragCent: 0, intervallMonate: 1, art: '50 (Lebenshaltung)', beteiligungen: [] })}>
			<Icon name="plus" size={18} />Gemeinsame Fixkosten anlegen
		</button>
	</div>
	<p class="note">
		{#if data.letzte}Zuletzt geändert {zeitpunkt(data.letzte.zeit)}: {data.letzte.text}.{/if}
		Ihr seht beide dieselben Daten.
	</p>
</div>

<PostenDialog bind:posten={bearbeitet} neuTitel="Neue gemeinsame Fixkosten" />
