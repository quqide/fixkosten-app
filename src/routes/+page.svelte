<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import PostenSymbol from '#lib/components/PostenSymbol.svelte';
	import Ring from '#lib/components/Ring.svelte';
	import Verlauf from '#lib/components/Verlauf.svelte';
	import { betragFeld, datumKurz, datumLang, eur, eurGanz, inTagen, zeitpunkt } from '#lib/format.ts';
	import type { SubmitFunction } from '$app/forms';
	import { mitRueckmeldung, zeigeToast } from '#lib/toast.svelte.ts';
	import { beschreibeAuftrag } from '#lib/rechnung/aufstellung.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let kontostandOffen = $state(false);
	const p = $derived(data.person);
	const iconVon = $derived(new Map(data.posten.map((x) => [x.name, x.icon])));
	const konto = $derived(p.modus === 1 ? 'Gehaltskonto' : 'Fixkosten-Konto');
	const anteil = $derived(data.gemeinschaft.anteil[p.id]);
	const v = $derived(data.vergleich);

	let actualFormular = $state<HTMLFormElement>();
	let actualLaeuft = $state(false);

	const mitActual = $derived(data.actual && !!p.actualKontoId && !data.zeitreise);
	const abgleich = $derived(p.istQuelle === 'actual' ? p.abgleich : null);
	const offen = $derived(abgleich?.auftraege.filter((a) => !a.gebucht) ?? []);

	// Einmal am Tag von selbst abrufen, danach auf Knopfdruck.
	$effect(() => {
		if (mitActual && actualFormular && !actualLaeuft && (p.istQuelle !== 'actual' || p.istDatum !== data.stichtag)) {
			actualFormular.requestSubmit();
		}
	});

	const actualAbruf: SubmitFunction = () => {
		actualLaeuft = true;
		return async ({ result, update }) => {
			await update({ reset: false, invalidateAll: true });
			actualLaeuft = false;
			if (result.type === 'failure') zeigeToast((result.data?.fehler as string) ?? 'Abruf aus Actual fehlgeschlagen.');
		};
	};


	const status = $derived.by(() => {
		if (!v) return null;
		if (v.status === 'unterdeckt')
			return {
				badge: 'Noch nicht ganz', klasse: 'unterdeckt', farbe: 'var(--warm)',
				titel: `Es fehlen noch ${eur(-v.differenzCent)}`,
				text: 'Kein Grund zur Sorge. Überweise den Betrag vor der nächsten großen Abbuchung, dann ist alles abgedeckt.'
			};
		if (v.status === 'ueberdeckt')
			return {
				badge: 'Mehr als nötig', klasse: 'ueberdeckt', farbe: 'var(--calm)',
				titel: `Du hast ${eur(v.differenzCent)} übrig`,
				text: 'Dieses Geld brauchst du für keine geplante Abbuchung. Du kannst es entnehmen oder als Puffer lassen.'
			};
		return {
			badge: 'Alles im Plan', klasse: 'passt', farbe: 'var(--tint)',
			titel: `Alles gedeckt, ${p.name}`,
			text: v.differenzCent >= 0
				? `Alle kommenden Abbuchungen sind bezahlt, mit ${eur(v.differenzCent)} Puffer.`
				: 'Alle kommenden Abbuchungen sind bezahlt.'
		};
	});

	const spitze = $derived(data.verlauf.length ? data.verlauf.reduce((a, b) => (b.sollCent > a.sollCent ? b : a)) : null);
	const summeDauerauftraege = $derived(data.aufstellung.dauerauftraege.reduce((s, d) => s + d.betragCent, 0));
	const artKlasse = (art: string | null) => `a${art?.slice(0, 2) ?? '50'}`;
	const detailZu = (i: number) => {
		const a = data.auftraege[i];
		return a ? `${a.zielkonto ? `aufs ${a.zielkonto}: ` : ''}${beschreibeAuftrag(a)}` : '';
	};
</script>

<svelte:head><title>Übersicht · Fixkosten</title></svelte:head>

<h1>Dein {konto}</h1>
<p class="lead">
	{#if data.zeitreise}
		So sieht es am {datumLang(data.stichtag)} aus. <a href="/">Zurück zu heute</a>
	{:else}
		Reicht das Geld für alle kommenden Abbuchungen? Hier siehst du es auf einen Blick.
	{/if}
</p>

{#if data.posten.length === 0}
	<div class="card empty">
		<h2>Willkommen, {p.name}</h2>
		<p>Trag zuerst deine regelmäßigen Zahlungen ein, zum Beispiel Versicherungen, Abos oder den Handyvertrag. Danach siehst du hier, wie viel du zurücklegen musst.</p>
		<a class="primary" href="/fixkosten?neu"><Icon name="plus" size={18} />Erste Fixkosten anlegen</a>
	</div>
{:else}
	<div class="card">
		{#if status && v}
			<div class="hero">
				<Ring anteil={data.fixkosten.sollCent > 0 ? v.istBereinigtCent / data.fixkosten.sollCent : 1} farbe={status.farbe} />
				<div>
					<span class="badge {status.klasse}">{status.badge}</span>
					<h2>{status.titel}</h2>
					<p>{status.text}</p>
					<div class="figures">
						<div>Sollte da sein<strong>{eur(data.fixkosten.sollCent)}</strong></div>
						<div>Ist da<strong>{eur(v.istBereinigtCent)}</strong></div>
					</div>
				</div>
			</div>
		{:else}
			<div class="hero">
				<div class="frage"><Icon name="uebersicht" size={30} /></div>
				<div>
					<h2>Wie viel ist gerade auf dem {konto}?</h2>
					{#if data.zeitreise}
						<p>An diesem Tag sollten {eur(data.fixkosten.sollCent)} auf dem Konto sein.</p>
					{:else if mitActual}
						<p>Der Kontostand kommt gleich aus Actual Budget. Sein sollten es {eur(data.fixkosten.sollCent)}.</p>
					{:else}
						<p>Trag den Kontostand ein. Dann zeigt dir die App, ob alle kommenden Abbuchungen gedeckt sind. Sein sollten es {eur(data.fixkosten.sollCent)}.</p>
					{/if}
				</div>
			</div>
		{/if}

		{#if mitActual}
			<form class="actual" method="POST" action="?/actual" bind:this={actualFormular} use:enhance={actualAbruf}>
				<div class="actual-text" aria-live="polite">
					{#if actualLaeuft}
						Kontostand wird aus Actual geholt …
					{:else if abgleich}
						<span>Aus Actual ({p.actualKontoName}), Stand {datumKurz(p.istDatum!)}.</span>
						<span>{abgleich.gehalt ? `Gehalt am ${datumKurz(abgleich.gehalt.datum)} eingegangen.` : 'Gehalt diesen Monat noch nicht da.'}
							{#if abgleich.gehalt}
								{offen.length === 0 ? 'Alle Daueraufträge sind gebucht.' : `Noch offen: ${offen.map((a) => a.name).join(', ')}.`}
							{/if}</span>
					{:else}
						Kontostand kommt aus Actual ({p.actualKontoName}).
					{/if}
				</div>
				{#if data.warnungen}
					<a class="warnhinweis" href="/einstellungen#actual">{data.warnungen === 1 ? 'Eine Warnung' : `${data.warnungen} Warnungen`} zur Einrichtung in Actual</a>
				{/if}
				<button class="secondary" type="submit" disabled={actualLaeuft}>{actualLaeuft ? 'Lädt …' : 'Neu abrufen'}</button>
			</form>
		{/if}

		{#if (kontostandOffen || (!v && !mitActual)) && !data.zeitreise}
			<form class="kontostand" method="POST" action="?/kontostand" use:enhance={mitRueckmeldung(() => (kontostandOffen = false))}>
				<div class="field">
					<label for="ist">Kontostand {konto} heute</label>
					<input id="ist" name="ist" inputmode="decimal" placeholder="0,00" value={betragFeld(p.istCent)}
						aria-invalid={!!form?.fehler} aria-describedby={form?.fehler ? 'ist-f' : undefined} />
					{#if form?.fehler}<span class="error" id="ist-f">{form.fehler}</span>{/if}
					{#if p.modus === 1}
						<label class="check"><input type="checkbox" name="ausstehend" checked={p.istAusstehend} />
							<span>Das Gehalt ist schon da, die Daueraufträge vom {p.ueberweisungstag}. aber noch nicht</span></label>
					{/if}
				</div>
				<div class="field"><button class="primary" type="submit">Kontostand speichern</button></div>
			</form>
		{/if}

		<details class="explain">
			<summary><Icon name="pfeil" size={14} />Wie wird das berechnet?</summary>
			<div class="body">
				<p>Für jede Fixkosten legst du jeden Monat einen Teil zurück, bei einer Jahreszahlung zum Beispiel ein Zwölftel. „Sollte da sein“ ist alles, was du seit der letzten Abbuchung schon angespart haben solltest.</p>
				{#if v}
					<p>
						{#if p.istQuelle === 'actual'}
							Der Kontostand kommt aus Actual Budget. Die App erkennt das Gehalt an einer Gutschrift von mindestens 70 % deines Nettos und die Daueraufträge am Betrag.
						{:else}
							Den Kontostand hast du am {datumKurz(p.istDatum!)} eingetragen.
						{/if}
						{#if data.ausstehendCent}Die noch offenen Daueraufträge ({eur(data.ausstehendCent)}) sind schon abgezogen.{/if}
						<button type="button" class="textlink" onclick={() => (kontostandOffen = !kontostandOffen)}>{mitActual ? 'Einmalig von Hand eintragen' : 'Kontostand aktualisieren'}</button>
					</p>
				{/if}
			</div>
		</details>
	</div>

	<div class="section">
		<div class="section-head"><h2>Jeden Monat am {p.ueberweisungstag}.</h2><span class="aside">von {eurGanz(p.nettoCent)} Netto</span></div>
		<div class="tiles">
			{#if p.modus === 1}
				<div class="card tile"><div class="k"><span class="dot" style="background:var(--violet)"></span>Aufs Spaßkonto</div><div class="v">{eurGanz(data.aufstellung.spassCent)}</div><div class="s">gehört ganz dir</div></div>
			{:else}
				<div class="card tile"><div class="k"><span class="dot" style="background:var(--calm)"></span>Aufs Fixkosten-Konto</div><div class="v">{eurGanz(data.aufstellung.fixkostenCent)}</div><div class="s">deckt alle Fixkosten</div></div>
			{/if}
			<div class="card tile"><div class="k"><span class="dot" style="background:var(--person-b)"></span>Aufs Gemeinschaftskonto</div><div class="v">{eurGanz(anteil.betragCent)}</div><div class="s">dein Anteil: {Math.round(anteil.gehaltsanteil * 100)} %</div></div>
		</div>
		{#if data.aufstellung.warnungen.length}
			<p class="note" role="alert" style="color:var(--warm)">{data.aufstellung.warnungen.join(' ')}</p>
		{/if}
		<div class="card" style="margin-top:14px">
			<ul class="rows">
				{#each data.aufstellung.dauerauftraege as d, i (i)}
					<li><div class="row">
						<PostenSymbol name={d.name} klasse={d.name === 'Spaßkonto' ? 'a30' : d.name === 'Gemeinschaftskonto' || d.name === 'Fixkosten' ? 'a50' : 'a20'} />
						<span class="main"><span class="title">{d.name}</span><span class="detail">{detailZu(i)}</span></span>
						<span class="value">{eur(d.betragCent)}</span>
					</div></li>
				{/each}
				<li><div class="row">
					<span class="icon neutral">=</span>
					<span class="main"><span class="title">{p.modus === 1 ? 'Bleibt für deine Fixkosten' : 'Bleibt zum Ausgeben'}</span>
						<span class="detail">{p.modus === 1 ? `gebraucht werden ${eur(data.fixkosten.summeMonatlichCent)}` : 'auf dem Gehaltskonto'}</span></span>
					<span class="value">{eur(p.nettoCent - summeDauerauftraege)}</span>
				</div></li>
			</ul>
		</div>
	</div>

	{#if data.naechste.length}
		<div class="section">
			<div class="section-head"><h2>Als Nächstes wird abgebucht</h2><a class="aside" href="/fixkosten">Alle ansehen</a></div>
			<div class="card"><ul class="rows">
				{#each data.naechste as z (z.name)}
					<li><div class="row">
						<PostenSymbol name={z.name} icon={iconVon.get(z.name)} klasse={artKlasse(z.art)} />
						<span class="main"><span class="title">{z.name}</span><span class="detail">{datumKurz(z.naechsteBuchung!)}, {inTagen(z.naechsteBuchung!, data.stichtag)}</span></span>
						<span class="value">{eur(z.betragCent)}</span>
					</div></li>
				{/each}
			</ul></div>
		</div>
	{/if}

	{#if data.verlauf.length && spitze}
		<div class="section">
			<div class="section-head"><h2>So viel brauchst du im nächsten Jahr</h2></div>
			<div class="card pad"><Verlauf punkte={data.verlauf} /></div>
			<p class="note">Am meisten Rücklage brauchst du am {datumLang(spitze.datum)}: {eur(spitze.sollCent)}. Danach sinkt sie mit der großen Abbuchung wieder.</p>
		</div>
	{/if}
{/if}

<form class="zeitreise" method="GET">
	<label for="stichtag">Anderes Datum ansehen</label>
	<input id="stichtag" name="stichtag" type="date" value={data.stichtag} />
	<button class="secondary" type="submit">Anzeigen</button>
</form>
{#if data.letzte}
	<p class="note">Zuletzt geändert {data.letzte.person === p.id ? 'von dir' : ''} {zeitpunkt(data.letzte.zeit)}: {data.letzte.text}</p>
{/if}

<style>
	.hero { display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: center; padding: 22px; }
	.hero h2 { font: 800 22px/1.25 var(--font); margin: 0; letter-spacing: -0.01em; }
	.hero p { margin: 6px 0 0; color: var(--secondary); }
	.figures { display: flex; gap: 22px; margin-top: 12px; flex-wrap: wrap; }
	.figures div { font-size: 13px; color: var(--secondary); }
	.figures strong { display: block; font-size: 17px; color: var(--label); font-variant-numeric: tabular-nums; }
	.frage { width: 72px; height: 72px; border-radius: 50%; background: var(--tint-soft); color: var(--tint); display: grid; place-items: center; }
	.badge { display: inline-flex; font-size: 13px; font-weight: 600; padding: 3px 10px; border-radius: 999px; margin-bottom: 8px; }
	.badge.passt { color: var(--tint); background: var(--tint-soft); }
	.badge.ueberdeckt { color: var(--calm); background: var(--calm-soft); }
	.badge.unterdeckt { color: var(--warm); background: var(--warm-soft); }
	.kontostand { border-top: 1px solid var(--separator); }
	.actual { border-top: 1px solid var(--separator); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; padding: 14px 22px; }
	.actual-text { display: grid; gap: 2px; font-size: 14px; color: var(--secondary); flex: 1 1 260px; }
	.actual .secondary { min-height: 40px; }
	.warnhinweis { font-size: 14px; font-weight: 600; color: var(--warm); flex-basis: 100%; order: 3; }
	.kontostand .field + .field { border-top: 0; padding-top: 0; }
	details.explain { border-top: 1px solid var(--separator); }
	summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; padding: 14px 22px; color: var(--tint); font-weight: 600; font-size: 15px; min-height: 48px; }
	summary::-webkit-details-marker { display: none; }
	summary :global(svg) { transition: transform 0.2s; }
	details[open] summary :global(svg) { transform: rotate(90deg); }
	.body { padding: 0 22px 18px; color: var(--secondary); font-size: 15px; }
	.body p { margin: 0 0 8px; max-width: 38em; }
	.zeitreise { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 36px; font-size: 14px; color: var(--secondary); }
	.zeitreise input { background: var(--surface); border: 1px solid var(--separator); border-radius: 10px; padding: 8px 10px; min-height: 40px; }
	.zeitreise .secondary { min-height: 40px; }
	@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } }
</style>
