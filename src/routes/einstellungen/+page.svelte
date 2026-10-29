<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import { betragFeld, zeitpunkt } from '#lib/format.ts';
	import { THEMES } from '#lib/themes.ts';
	import { mitRueckmeldung, rueckgaengig, toast } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const p = $derived(data.person);
	const fehler = $derived((form?.fehler ?? {}) as Record<string, string>);
	const fehlerIn = (bereich: string) => (form?.bereich === bereich ? fehler : {});

	let rueckstellungen = $state<{ name: string; betrag: string; ziel: string }[]>([]);
	$effect(() => {
		rueckstellungen = data.rueckstellungen.map((r) => ({ name: r.name, betrag: betragFeld(r.betragCent), ziel: r.zielkonto ?? '' }));
	});

	let importBestaetigen = $state(false);

	const modelle = [
		{ wert: 1, titel: 'Spaßkonto mit festem Betrag', text: 'Fixkosten gehen direkt vom Gehaltskonto ab. Die App rechnet aus, wie viel aufs Spaßkonto darf.' },
		{ wert: 2, titel: 'Eigenes Fixkosten-Konto', text: 'Eine feste Monatsrate geht auf ein eigenes Konto. Der Rest auf dem Gehaltskonto ist frei.' }
	];
	const hellOptionen = [
		{ wert: 'auto', name: 'Automatisch' },
		{ wert: 'light', name: 'Hell' },
		{ wert: 'dark', name: 'Dunkel' }
	];

	async function verlaufRueckgaengig(id: number) {
		toast.undoId = id;
		await rueckgaengig();
	}
</script>

<svelte:head><title>Einstellungen · Fixkosten</title></svelte:head>

<h1>Einstellungen</h1>
<p class="lead">Gilt nur für {p.name}. Die andere Person hat eigene Einstellungen.</p>

<div class="section" style="margin-top:8px">
	<div class="section-head"><h2>Wie sind deine Konten aufgebaut?</h2></div>
	<form method="POST" action="?/modus" use:enhance={mitRueckmeldung()} class="choice">
		{#each modelle as m (m.wert)}
			<label>
				<input type="radio" name="modus" value={m.wert} checked={p.modus === m.wert} onchange={(e) => e.currentTarget.form?.requestSubmit()} />
				<strong>{m.titel}</strong><span>{m.text}</span>
			</label>
		{/each}
		<noscript><button class="secondary" type="submit">Übernehmen</button></noscript>
	</form>
</div>

<form method="POST" action="?/profil" use:enhance={mitRueckmeldung()} class="section">
	<div class="section-head"><h2>Über dich</h2></div>
	<div class="card">
		{#each [
			{ id: 'name', label: 'Dein Name', wert: p.name, modus: 'text', hilfe: '' },
			{ id: 'netto', label: 'Nettogehalt pro Monat', wert: betragFeld(p.nettoCent), modus: 'decimal', hilfe: 'In Euro, zum Beispiel 3450' },
			{ id: 'etf', label: 'ETF-Sparquote in Prozent', wert: p.etfProzent.toLocaleString('de-DE'), modus: 'decimal', hilfe: 'Anteil vom Netto, der jeden Monat ins Depot geht.' },
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

<form method="POST" action="?/rueckstellungen" use:enhance={mitRueckmeldung()} class="section">
	<div class="section-head"><h2>Feste Rücklagen</h2><span class="aside">gehen jeden Monat raus</span></div>
	<div class="card">
		{#each rueckstellungen as r, i (i)}
			<fieldset class="field rueck">
				<legend class="label">Rücklage {i + 1}</legend>
				<input name="r_name" bind:value={r.name} placeholder="Wofür? z. B. Urlaub" aria-label="Wofür" />
				<div class="inline-fields">
					<input name="r_betrag" bind:value={r.betrag} inputmode="decimal" placeholder="Betrag pro Monat" aria-label="Betrag pro Monat" />
					<input name="r_ziel" bind:value={r.ziel} placeholder="Auf welches Konto?" aria-label="Zielkonto" />
				</div>
				{#if fehlerIn('rueckstellungen')[`r_${i}`]}<span class="error">{fehlerIn('rueckstellungen')[`r_${i}`]}</span>{/if}
				<button type="button" class="textlink entfernen" onclick={() => rueckstellungen.splice(i, 1)}>Entfernen</button>
			</fieldset>
		{:else}
			<div class="field"><span class="help">Zum Beispiel für den Urlaub oder die Schlussrate vom Auto. Diese Beträge gehen fest jeden Monat vom Gehaltskonto ab.</span></div>
		{/each}
		<div class="field buttons">
			<button type="button" class="secondary" onclick={() => rueckstellungen.push({ name: '', betrag: '', ziel: '' })}><Icon name="plus" size={18} />Rücklage hinzufügen</button>
			<button class="primary" type="submit">Speichern</button>
		</div>
	</div>
</form>

<form method="POST" action="?/darstellung" use:enhance={() => async ({ update }) => update({ reset: false })} class="section">
	<div class="section-head"><h2>Darstellung</h2><span class="aside">wirkt sofort</span></div>
	<div class="swatches">
		{#each Object.entries(THEMES) as [id, t] (id)}
			<label class="swatch">
				<input type="radio" name="theme" value={id} checked={p.theme === id} onchange={(e) => e.currentTarget.form?.requestSubmit()} />
				<span class="preview" aria-hidden="true">
					<span style="background:{t.hell.tint}"></span><span style="background:{t.hell.tintSoft}"></span><span style="background:{t.dunkel.surface}"></span>
				</span>
				<strong>{t.name}<span class="haken" aria-hidden="true"><Icon name="haken" size={12} /></span></strong>
			</label>
		{/each}
	</div>
	<div class="modes" role="radiogroup" aria-label="Hell oder dunkel">
		{#each hellOptionen as h (h.wert)}
			<label><input type="radio" name="hell" value={h.wert} checked={p.hell === h.wert} onchange={(e) => e.currentTarget.form?.requestSubmit()} />{h.name}</label>
		{/each}
	</div>
	<noscript><button class="secondary" type="submit">Übernehmen</button></noscript>
	<p class="note">„Automatisch“ folgt der Einstellung deines Geräts. Jede Person hat ihr eigenes Farbthema.</p>
</form>

<div class="section">
	<div class="section-head"><h2>Kontostand aus Actual Budget</h2></div>
	<div class="card pad"><p class="help-text">Die Anbindung an Actual Budget kommt im nächsten Schritt. Bis dahin trägst du den Kontostand auf der Übersicht selbst ein.</p></div>
</div>

<div class="section">
	<div class="section-head"><h2>Deine Daten</h2></div>
	<div class="card">
		<div class="field">
			<span class="label">Sicherung</span>
			<span class="help">Lädt alle Daten von euch beiden als Datei herunter. Damit kannst du sie später wieder einspielen.</span>
			<a class="secondary" href="/export" download>Sicherung herunterladen</a>
		</div>
		<form class="field" method="POST" action="?/import" enctype="multipart/form-data" use:enhance={mitRueckmeldung(() => (importBestaetigen = false))}>
			<label for="datei">Sicherung einspielen</label>
			<input id="datei" name="datei" type="file" accept="application/json,.json" />
			{#if fehlerIn('import').datei}<span class="error">{fehlerIn('import').datei}</span>{/if}
			{#if importBestaetigen}
				<span class="error">Das ersetzt alle aktuellen Daten von euch beiden. Wirklich einspielen?</span>
				<div class="inline-fields">
					<button type="button" class="secondary" onclick={() => (importBestaetigen = false)}>Abbrechen</button>
					<button type="submit" class="primary">Ja, ersetzen</button>
				</div>
			{:else}
				<button type="button" class="secondary" onclick={() => (importBestaetigen = true)}>Einspielen …</button>
			{/if}
		</form>
	</div>
</div>

{#if data.verlauf.length}
	<div class="section">
		<div class="section-head"><h2>Letzte Änderungen</h2><span class="aside">von euch beiden</span></div>
		<div class="card"><ul class="rows">
			{#each data.verlauf as a (a.id)}
				<li><div class="row">
					<span class="avatar klein {a.person}">{data.namen[a.person]?.charAt(0)}</span>
					<span class="main"><span class="title">{a.text}</span><span class="detail">{data.namen[a.person]}, {zeitpunkt(a.zeit)}</span></span>
					{#if a.kannRueckgaengig}<button type="button" class="textlink" onclick={() => verlaufRueckgaengig(a.id)}>Rückgängig</button>{/if}
				</div></li>
			{/each}
		</ul></div>
	</div>
{/if}

<style>
	.rueck { border: 0; margin: 0; }
	.rueck legend { padding: 0; margin-bottom: 6px; }
	.entfernen { justify-self: start; color: var(--warm); }
	.buttons { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; }
	.help-text { margin: 0; color: var(--secondary); }
	.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
	.swatch { border: 2px solid var(--separator); background: var(--surface); border-radius: 14px; padding: 12px; cursor: pointer; display: grid; gap: 10px; }
	.swatch:has(input:checked) { border-color: var(--tint); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tint) 20%, transparent); }
	.swatch:has(input:focus-visible), .modes label:has(input:focus-visible) { outline: 3px solid color-mix(in srgb, var(--tint) 60%, transparent); outline-offset: 2px; }
	.swatch input, .modes input { position: absolute; opacity: 0; pointer-events: none; }
	.preview { display: flex; height: 34px; border-radius: 9px; overflow: hidden; }
	.preview span { flex: 1; }
	.preview span:first-child { flex: 2; }
	.swatch strong { font-size: 15px; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
	.haken { width: 20px; height: 20px; border-radius: 50%; background: var(--tint); color: var(--surface); display: none; place-items: center; }
	.swatch:has(input:checked) .haken { display: grid; }
	.modes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; background: var(--fill); border-radius: 14px; padding: 4px; margin-top: 14px; }
	.modes label { border-radius: 10px; min-height: 40px; font-weight: 600; color: var(--secondary); cursor: pointer; display: grid; place-items: center; }
	.modes label:has(input:checked) { background: var(--surface); color: var(--label); box-shadow: var(--shadow); }
	input[type='file'] { background: none !important; padding-left: 0 !important; }
</style>
