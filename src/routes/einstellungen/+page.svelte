<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import { betragFeld, eur, intervallText, zeitpunkt } from '#lib/format.ts';
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

	const z = $derived(data.zuordnung);

	function rhythmus(t: { rhythmus: { frequenz: string; intervall: number } | null }) {
		if (!t.rhythmus) return 'ohne Rhythmus';
		const n = t.rhythmus.intervall;
		if (t.rhythmus.frequenz === 'monthly') return intervallText(n);
		if (t.rhythmus.frequenz === 'yearly') return intervallText(12 * n);
		return t.rhythmus.frequenz === 'weekly' ? 'wöchentlich' : 'täglich';
	}

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
	<div class="section-head" id="actual"><h2>Actual Budget</h2><span class="aside">freiwillig</span></div>
	<div class="card">
		{#if !data.actual}
			<div class="field">
				<p class="help-text">Wenn du Actual Budget nutzt, kann die App den Kontostand selbst abrufen und erkennen, ob Gehalt und Daueraufträge schon gebucht sind. Ohne Actual trägst du den Kontostand einfach auf der Übersicht ein.</p>
				<details class="einrichten">
					<summary>So richtest du es ein</summary>
					<p class="help-text">Trag in Dockge beim Stack diese Umgebungsvariablen ein und starte ihn neu. Für die zweite Person heißen sie ACTUAL_B_… statt ACTUAL_A_….</p>
					<pre>ACTUAL_{p.id.toUpperCase()}_URL=http://actual:5006
ACTUAL_{p.id.toUpperCase()}_PASSWORD=dein Actual-Passwort
ACTUAL_{p.id.toUpperCase()}_SYNC_ID=Sync-ID aus Actual (Einstellungen → Erweitert)</pre>
					<p class="help-text">Ist dein Budget Ende-zu-Ende-verschlüsselt, kommt noch ACTUAL_{p.id.toUpperCase()}_E2E_PASSWORD dazu.</p>
				</details>
			</div>
		{:else}
			<form class="field" method="POST" action="?/actualKonto" use:enhance={mitRueckmeldung()}>
				<label for="konto">Welches Konto zeigt die Übersicht?</label>
				{#await data.actualKonten}
					<span class="help">Konten werden aus Actual geladen …</span>
				{:then ergebnis}
					{#if ergebnis?.fehler}
						<span class="error">{ergebnis.fehler}</span>
					{:else}
						<select id="konto" name="konto" onchange={(e) => e.currentTarget.form?.requestSubmit()} aria-describedby="konto-h">
							<option value="" selected={!p.actualKontoId}>Keins, Kontostand von Hand eintragen</option>
							{#each ergebnis?.konten ?? [] as k (k.id)}
								<option value="{k.id}|{k.name}" selected={p.actualKontoId === k.id}>{k.name}</option>
							{/each}
						</select>
						<span class="help" id="konto-h">Wähl dein {p.modus === 1 ? 'Gehaltskonto' : 'Fixkosten-Konto'}. Die App liest nur, sie ändert nichts in Actual.</span>
						<noscript><button class="secondary" type="submit">Übernehmen</button></noscript>
					{/if}
				{/await}
			</form>
			{#if p.actualKontoId}
				<form class="field abruf" method="POST" action="?/actualAbruf" use:enhance={mitRueckmeldung()}>
					<span class="label">Abgleich</span>
					<span class="help">
						{z ? `Zuletzt abgerufen ${zeitpunkt(z.zeit)}.` : 'Noch nichts abgerufen.'}
						Fixkosten, Beträge und Termine kommen aus den Terminplänen in Actual.
					</span>
					{#if fehlerIn('actual').actual}<span class="error">{fehlerIn('actual').actual}</span>{/if}
					<button class="secondary" type="submit">Jetzt abrufen</button>
				</form>
				{#if z}
					<form class="field" method="POST" action="?/gehaltKategorie" use:enhance={mitRueckmeldung()}>
						<label for="gehalt">Woran erkennt die App dein Gehalt?</label>
						<select id="gehalt" name="kategorie" onchange={(e) => e.currentTarget.form?.requestSubmit()} aria-describedby="gehalt-h">
							<option value="" selected={!p.actualGehaltKategorie}>Am Betrag (ab 70 % vom Netto)</option>
							{#each z.einnahmeKategorien as k (k.id)}
								<option value={k.id} selected={p.actualGehaltKategorie === k.id}>Kategorie „{k.name}“</option>
							{/each}
						</select>
						<span class="help" id="gehalt-h">Mit Kategorie zählen große Umbuchungen nicht als Gehalt.</span>
						<noscript><button class="secondary" type="submit">Übernehmen</button></noscript>
					</form>
				{/if}
			{/if}
		{/if}
	</div>
</div>

{#if data.warnungen.length}
	<div class="section">
		<div class="section-head"><h2>Prüfung der Einrichtung</h2><span class="aside">{data.warnungen.length} {data.warnungen.length === 1 ? 'Punkt' : 'Punkte'}</span></div>
		<div class="card"><ul class="rows">
			{#each data.warnungen as w, i (i)}
				<li><div class="row warnung">
					<span class="stufe {w.stufe}" aria-label={w.stufe === 'warnung' ? 'Warnung' : 'Hinweis'}>{w.stufe === 'warnung' ? '!' : 'i'}</span>
					<span class="main"><span class="title">{w.text}</span><span class="detail">{w.tun}</span></span>
				</div></li>
			{/each}
		</ul></div>
		<p class="note">Die App ändert nichts in Actual. Nach einer Korrektur dort einfach neu abrufen.</p>
	</div>
{/if}

{#if z && z.terminplaene.length}
	<form class="section" method="POST" action="?/zuordnung" use:enhance={mitRueckmeldung()}>
		<div class="section-head"><h2>Terminpläne zuordnen</h2><span class="aside">aus Actual</span></div>
		<div class="card">
			<ul class="rows">
				{#each z.terminplaene as t (t.id)}
					{@const wahl = t.wahl}
					<li><div class="row zuordnung">
						<span class="main">
							<span class="title">{t.name}{#if !t.rolle}<span class="neu">neu</span>{/if}</span>
							<span class="detail">{eur(t.betragCent)} · {rhythmus(t)}{t.kontoId !== p.actualKontoId ? ` · ${t.kontoName}` : ''}{t.umbuchung ? ' · Umbuchung' : ''}</span>
						</span>
						<select name="rolle_{t.id}" aria-label="Rolle von {t.name}">
							<option value="fixkosten" selected={wahl === 'fixkosten'}>Fixkosten</option>
							{#each z.freiePosten as fp (fp.id)}
								<option value="fixkosten:{fp.id}" selected={wahl === `fixkosten:${fp.id}`}>Fixkosten, verknüpft mit „{fp.name}“</option>
							{/each}
							{#each z.dauerauftraege as d (d)}
								<option value="dauerauftrag:{d}" selected={wahl === `dauerauftrag:${d}`}>Dauerauftrag {d}</option>
							{/each}
							<option value="ignorieren" selected={wahl === 'ignorieren'}>Nicht berücksichtigen</option>
						</select>
					</div></li>
				{/each}
			</ul>
			<div class="field"><button class="primary" type="submit">Zuordnung speichern</button></div>
		</div>
		<p class="note">Fixkosten übernimmt die App mit Name, Betrag und Rhythmus aus Actual. Von Hand angelegte Posten mit gleichem Namen werden vorgeschlagen, damit nichts doppelt entsteht.</p>
	</form>
{/if}

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
	.abruf .secondary { justify-self: start; }
	.stufe { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; flex: none; }
	.stufe.warnung { background: var(--warm-soft); color: var(--warm); }
	.stufe.hinweis { background: var(--calm-soft); color: var(--calm); }
	.warnung .title { font-weight: 600; }
	.zuordnung { flex-wrap: wrap; }
	.zuordnung .main { flex: 1 1 200px; }
	.zuordnung select { flex: 1 1 220px; max-width: 100%; font-size: 15px; background: var(--fill); border: 2px solid transparent; border-radius: 10px; padding: 8px 10px; min-height: 44px; color: var(--label); }
	.neu { font-size: 12px; font-weight: 700; color: var(--tint); background: var(--tint-soft); border-radius: 999px; padding: 1px 8px; margin-left: 8px; vertical-align: 2px; }
	.einrichten summary { cursor: pointer; color: var(--tint); font-weight: 600; min-height: 44px; display: flex; align-items: center; }
	.einrichten pre { background: var(--fill); border-radius: 10px; padding: 12px; font-size: 13px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin: 8px 0; }
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
