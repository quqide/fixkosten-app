<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { eur, intervallText } from '#lib/format.ts';
	import type { NeueZeile } from '#lib/rechnung/rechner.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const leer = (): NeueZeile => ({ name: '', betrag: '', intervall: '', wer: 'persoenlich' });
	// Eingetippte Zeilen plus eine freie; „Weitere Zeile“ hängt bis zum Absenden noch welche an.
	let zeilen = $derived([...data.felder.zeilen, leer()]);
	// Nach Feld, nicht nach Text: zwei Zeilen können dieselbe Meldung haben.
	const fehlerListe = $derived(Object.entries(data.fehler));

	const differenz = (cent: number) => (cent === 0 ? eur(0) : `${cent > 0 ? '+' : '−'}${eur(Math.abs(cent))}`);
	const wert = (cent: number | null) => (cent == null ? '–' : eur(cent));
</script>

<svelte:head><title>Rechner · Fixkosten</title></svelte:head>

<a class="zurueck" href="/plan"><span aria-hidden="true">‹</span> Mein Plan</a>
<h1>Was wäre, wenn …</h1>
<p class="lead">Probier aus, wie sich ein neues Gehalt, eine andere Miete oder ein neuer Vertrag auf deinen Monat auswirken.</p>
<p class="hinweis" role="note"><strong>Hier wird nichts gespeichert.</strong> Deine Daten bleiben, wie sie sind.</p>

{#if fehlerListe.length}
	<div class="card fehler" role="alert">
		<p>Nicht alles konnte übernommen werden. Für diese Felder rechnet der Rechner mit dem heutigen Wert:</p>
		<ul>{#each fehlerListe as [feld, f] (feld)}<li>{f}</li>{/each}</ul>
	</div>
{/if}

<form method="GET" class="eingaben">
	<div class="section">
		<div class="section-head"><h2>Einkommen</h2></div>
		<div class="card inline-felder">
			<div class="field">
				<label for="r-netto">Dein Netto ({data.namen.ich})</label>
				<input id="r-netto" name="netto" value={data.felder.netto} inputmode="decimal" aria-invalid={!!data.fehler.netto} />
			</div>
			<div class="field">
				<label for="r-netto2">Netto {data.namen.andere}</label>
				<input id="r-netto2" name="netto2" value={data.felder.netto2} inputmode="decimal" aria-invalid={!!data.fehler.netto2} />
			</div>
		</div>
	</div>

	{#if data.felder.positionen.length}
		<div class="section">
			<div class="section-head"><h2>Gemeinschaftskonto</h2></div>
			<div class="card inline-felder">
				{#each data.felder.positionen as p (p.id)}
					<div class="field">
						<label for="r-pos-{p.id}">{p.name}</label>
						<input id="r-pos-{p.id}" name="pos_{p.id}" value={p.wert} inputmode="decimal" aria-invalid={!!data.fehler[`pos_${p.id}`]} />
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="section">
		<div class="section-head"><h2>Zusätzliche Posten</h2></div>
		<div class="card">
			{#each zeilen as z, i (i)}
				<fieldset class="field neu">
					<legend class="label">Posten {i + 1}</legend>
					<div class="neu-felder">
						<input name="n_name" value={z.name} placeholder="Name, z. B. Neues Auto" aria-label="Name" maxlength="100" />
						<input name="n_betrag" value={z.betrag} placeholder="Betrag" inputmode="decimal" aria-label="Betrag in Euro"
							aria-invalid={!!data.fehler[`n_${i}`]} />
						<input name="n_intervall" value={z.intervall} placeholder="1" inputmode="numeric" aria-label="Alle wie viele Monate"
							aria-invalid={!!data.fehler[`n_${i}`]} />
						<select name="n_wer" value={z.wer} aria-label="Für wen">
							<option value="persoenlich">nur ich</option>
							<option value="gemeinsam">gemeinsam</option>
						</select>
					</div>
					{#if data.fehler[`n_${i}`]}<span class="error">{data.fehler[`n_${i}`]}</span>{/if}
				</fieldset>
			{/each}
			<div class="field">
				<span class="help">Betrag in Euro, Intervall in Monaten (1 = monatlich, 12 = jährlich).</span>
				<button type="button" class="secondary" onclick={() => (zeilen = [...zeilen, leer()])}><Icon name="plus" size={18} />Weitere Zeile</button>
			</div>
		</div>
	</div>

	{#if data.felder.posten.length}
		<div class="section">
			<div class="section-head"><h2>Posten weglassen</h2><span class="aside">testweise</span></div>
			<div class="card">
				<ul class="weglassen">
					{#each data.felder.posten as p (`${p.gemeinsam}-${p.id}`)}
						<li>
							<label class="check">
								<input type="checkbox" name="ohne" value={p.id} checked={p.ohne} />
								<span>{p.name}{#if p.gemeinsam}<span class="tag">gemeinsam</span>{/if}<small>{eur(p.betragCent)} {intervallText(p.intervallMonate)}</small></span>
							</label>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}

	<div class="knoepfe">
		<button class="primary" type="submit">Berechnen</button>
		<a class="secondary" href="/rechner">Zurücksetzen</a>
	</div>
</form>

<div class="section" aria-live="polite">
	<div class="section-head"><h2>Ergebnis</h2><span class="aside">{data.geaendert ? 'mit deinen Änderungen' : 'noch keine Änderung'}</span></div>
	{#each data.vergleich as g (g.titel)}
		<div class="card vergleich">
			<div class="kopf"><span class="titel">{g.titel}</span><span>Heute</span><span>Mit Änderung</span><span>Differenz</span></div>
			{#each g.zeilen as z, i (i)}
				<div class="zeile">
					<span class="name">{z.name}</span>
					<span class="zahl" data-label="Heute">{wert(z.heuteCent)}</span>
					<span class="zahl" data-label="Mit Änderung">{wert(z.mitCent)}</span>
					<span class="zahl diff" class:anders={z.differenzCent !== 0} data-label="Differenz">{differenz(z.differenzCent)}</span>
				</div>
			{/each}
		</div>
	{/each}

	{#if data.warnungen.heute.length || data.warnungen.mit.length}
		<div class="card warnungen">
			<div>
				<h3>Warnungen heute</h3>
				{#if data.warnungen.heute.length}<ul>{#each data.warnungen.heute as w, i (i)}<li>{w}</li>{/each}</ul>{:else}<p>Keine.</p>{/if}
			</div>
			<div>
				<h3>Warnungen mit Änderung</h3>
				{#if data.warnungen.mit.length}<ul>{#each data.warnungen.mit as w, i (i)}<li>{w}</li>{/each}</ul>{:else}<p>Keine.</p>{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.zurueck { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; color: var(--tint); font-weight: 600; text-decoration: none; }
	.hinweis { margin: -8px 4px 0; font-size: 15px; color: var(--secondary); }
	.hinweis strong { color: var(--label); }
	.fehler { margin-top: 18px; padding: 14px 20px; color: var(--warm); font-weight: 600; font-size: 15px; }
	.fehler p { margin: 0 0 6px; }
	.fehler ul { margin: 0; padding-left: 20px; }
	.inline-felder { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
	.inline-felder .field + .field { border-top: 0; }
	fieldset.neu { border: 0; margin: 0; min-width: 0; }
	fieldset.neu + fieldset.neu { border-top: 1px solid var(--separator); }
	legend { float: left; width: 100%; padding: 0; margin-bottom: 6px; }
	.neu-felder { clear: both; }
	.neu-felder { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) 70px minmax(0, 1.2fr); gap: 8px; }
	.neu-felder input, .neu-felder select { font-size: 16px; color: var(--label); background: var(--fill); border: 2px solid transparent; border-radius: 10px; padding: 10px 12px; min-height: 46px; width: 100%; }
	.neu-felder input:focus, .neu-felder select:focus { border-color: var(--tint); outline: none; background: var(--surface); }
	.neu-felder input[aria-invalid='true'] { border-color: var(--warm); }
	.field .secondary { justify-self: start; }
	.weglassen { list-style: none; margin: 0; padding: 4px 20px; }
	.weglassen li { padding: 10px 0; }
	.weglassen li + li { border-top: 1px solid var(--separator); }
	.weglassen small { display: block; color: var(--secondary); font-size: 13px; }
	.tag { margin-left: 8px; font-size: 12px; font-weight: 700; color: var(--calm); }
	.knoepfe { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
	.vergleich { margin-bottom: 12px; padding: 6px 0; }
	.kopf, .zeile { display: grid; grid-template-columns: minmax(0, 1fr) repeat(3, 8.5em); gap: 8px; align-items: baseline; padding: 8px 20px; }
	.kopf { font-size: 13px; color: var(--secondary); font-weight: 600; text-align: right; }
	.kopf .titel { text-align: left; color: var(--label); font-size: 15px; font-weight: 700; }
	.zeile + .zeile, .kopf + .zeile { border-top: 1px solid var(--separator); }
	.zahl { text-align: right; font-variant-numeric: tabular-nums; }
	.diff { color: var(--secondary); }
	.diff.anders { color: var(--label); font-weight: 700; }
	.warnungen { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px 24px; padding: 14px 20px; font-size: 15px; }
	.warnungen h3 { margin: 0 0 6px; font-size: 15px; }
	.warnungen ul { margin: 0; padding-left: 18px; color: var(--warm); }
	.warnungen p { margin: 0; color: var(--secondary); }
	@media (max-width: 640px) {
		.neu-felder { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
		.kopf { display: block; text-align: left; }
		.kopf span:not(.titel) { display: none; }
		.zeile { grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 2px; }
		.zeile .name { grid-column: 1 / -1; font-weight: 600; }
		.zahl { text-align: left; font-size: 15px; }
		.zahl::before { content: attr(data-label); display: block; font-size: 12px; color: var(--secondary); font-weight: 600; }
	}
</style>
