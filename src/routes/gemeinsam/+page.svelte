<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import PostenDialog from '#lib/components/PostenDialog.svelte';
	import PostenListe from '#lib/components/PostenListe.svelte';
	import PostenSymbol from '#lib/components/PostenSymbol.svelte';
	import { betragFeld, eur, eurGanz, zeitpunkt } from '#lib/format.ts';
	import type { FixkostenPosten } from '#lib/rechnung/fixkosten.ts';
	import { SCHRITTE } from '#lib/rechnung/rundung.ts';
	import { STANDARD_ANTEIL_RUNDUNG } from '#lib/rechnung/gemeinschaft.ts';
	import { mitRueckmeldung } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let bearbeitet = $state<(FixkostenPosten & { id?: number }) | null>(null);
	const r = $derived(data.rechnung);
	const rundung = $derived(data.konto.rundung ?? STANDARD_ANTEIL_RUNDUNG);
	let positionenOffen = $state(false);

	type Entwurf = { schluessel: number; id?: number; name: string; art: 'fest' | 'fixkosten'; betrag: string; ausgang: '' | 'ueberweisung' | 'umbuchung'; ziel: string; tag: string; kategorie: string };
	let entwurf = $state<Entwurf[]>([]);
	let zaehler = 0;
	function bearbeiten() {
		entwurf = data.konto.positionen.map((p) => ({
			schluessel: zaehler++,
			id: p.id,
			name: p.name,
			art: p.art,
			betrag: betragFeld(p.betragCent),
			ausgang: p.ausgang?.art ?? '',
			ziel: p.ausgang?.ziel ?? '',
			tag: p.ausgang?.tag ? String(p.ausgang.tag) : '',
			kategorie: p.kategorie[data.ich] ?? ''
		}));
		positionenOffen = true;
	}
	function neuePosition() {
		entwurf.push({ schluessel: zaehler++, name: '', art: 'fest', betrag: '', ausgang: '', ziel: '', tag: '', kategorie: '' });
	}

	type Konf = (typeof data.konto.positionen)[number] | undefined;
	function ausgangText(p: Konf) {
		if (!p) return '';
		const quelle = p.art === 'fixkosten' ? 'aus der Liste unten, aufgerundet' : '';
		if (!p.ausgang) return quelle || 'bleibt auf dem Konto';
		const wann = p.ausgang.tag ? ` am ${p.ausgang.tag}.` : '';
		const wohin = p.ausgang.art === 'ueberweisung' ? `Überweisung an ${p.ausgang.ziel || '…'}` : `Umbuchung auf ${p.ausgang.ziel || '…'}`;
		return `${wohin}${wann}`;
	}
	const ausgaenge = $derived(
		data.konto.positionen
			.map((p, i) => ({ p, betragCent: r.positionen[i]?.betragCent ?? 0 }))
			.filter(({ p }) => p.ausgang)
			.map(({ p, betragCent }) => ({ name: p.name, tag: p.ausgang!.tag, text: ausgangText(p), betragCent }))
			.sort((a, b) => (a.tag ?? 99) - (b.tag ?? 99))
	);
	const ausgaengeSumme = $derived(ausgaenge.reduce((s, a) => s + a.betragCent, 0));
	const eingang = $derived(r.anteile[0].betragCent + r.anteile[1].betragCent);
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
	<form class="rundung" method="POST" action="?/rundung" use:enhance={mitRueckmeldung()}>
		<span>Beide Anteile werden</span>
		<select name="schritt" aria-label="Rundungsschritt" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			{#each SCHRITTE as sch (sch)}<option value={sch} selected={rundung.schritt === sch}>{sch === 1 ? 'centgenau' : `auf ${(sch / 100).toLocaleString('de-DE')} €`}</option>{/each}
		</select>
		<select name="richtung" aria-label="Rundungsrichtung" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="auf" selected={rundung.richtung === 'auf'}>aufgerundet</option>
			<option value="ab" selected={rundung.richtung === 'ab'}>abgerundet</option>
			<option value="kaufm" selected={rundung.richtung === 'kaufm'}>kaufmännisch gerundet</option>
		</select>
		<noscript><button class="secondary" type="submit">Übernehmen</button></noscript>
	</form>
	<p class="note">Beim Aufrunden bleibt der kleine Rest als Puffer auf dem Konto.</p>
</div>

<div class="section">
	<div class="section-head">
		<h2>Daraus setzt sich die Summe zusammen</h2>
		<button type="button" class="textlink" onclick={() => (positionenOffen ? (positionenOffen = false) : bearbeiten())}>{positionenOffen ? 'Abbrechen' : 'Ändern'}</button>
	</div>
	<div class="card">
		{#if positionenOffen}
			<form method="POST" action="?/positionen" use:enhance={mitRueckmeldung(() => (positionenOffen = false))}>
				{#each entwurf as pos, i (pos.schluessel)}
					<fieldset class="field position">
						<legend class="label">Position {i + 1}</legend>
						<input type="hidden" name="pos_id" value={pos.id ?? ''} />
						<input name="pos_name" bind:value={pos.name} placeholder="Wofür? z. B. Miete" aria-label="Name der Position" />
						<div class="inline-fields">
							<select name="pos_art" bind:value={pos.art} aria-label="Art">
								<option value="fest">Fester Betrag</option>
								<option value="fixkosten">Aus den gemeinsamen Fixkosten</option>
							</select>
							{#if pos.art === 'fest'}
								<input name="pos_betrag" bind:value={pos.betrag} inputmode="decimal" placeholder="Betrag pro Monat" aria-label="Betrag pro Monat" />
							{:else}
								<input type="hidden" name="pos_betrag" value="0" />
								<span class="help berechnet">{eur(r.fixkostenCent)}, berechnet</span>
							{/if}
						</div>
						<div class="inline-fields">
							<select name="pos_ausgang" bind:value={pos.ausgang} aria-label="Was passiert mit dem Geld?">
								<option value="">Bleibt auf dem Konto</option>
								<option value="ueberweisung">Geht per Überweisung raus</option>
								<option value="umbuchung">Wird umgebucht (eigenes Konto)</option>
							</select>
							{#if pos.ausgang}
								<input name="pos_ziel" bind:value={pos.ziel} placeholder={pos.ausgang === 'ueberweisung' ? 'An wen?' : 'Auf welches Konto?'} aria-label="Ziel" />
								<input name="pos_tag" bind:value={pos.tag} inputmode="numeric" placeholder="Tag" aria-label="Tag im Monat" class="tag" />
							{:else}
								<input type="hidden" name="pos_ziel" value="" /><input type="hidden" name="pos_tag" value="" />
							{/if}
						</div>
						{#if data.kategorien.length}
							<select name="pos_kat" bind:value={pos.kategorie} aria-label="Kategorie in Actual">
								<option value="">Kategorie in Actual: keine</option>
								{#each data.kategorien as k (k.id)}<option value={k.id}>Kategorie in Actual: {k.name}</option>{/each}
							</select>
						{:else}
							<input type="hidden" name="pos_kat" value={pos.kategorie} />
						{/if}
						{#if fehler[`pos_${i}`]}<span class="error">{fehler[`pos_${i}`]}</span>{/if}
						<button type="button" class="textlink entfernen" onclick={() => entwurf.splice(i, 1)}>Entfernen</button>
					</fieldset>
				{/each}
				{#if fehler.allgemein}<div class="field"><span class="error">{fehler.allgemein}</span></div>{/if}
				<div class="field buttons">
					<button type="button" class="secondary" onclick={neuePosition}><Icon name="plus" size={18} />Position hinzufügen</button>
					<button class="primary" type="submit">Speichern</button>
				</div>
			</form>
		{:else}
			<ul class="rows">
				{#each r.positionen as pos, i (i)}
					{@const konf = data.konto.positionen[i]}
					<li><div class="row"><PostenSymbol name={pos.name} klasse={konf?.art === 'fixkosten' ? 'a50' : konf?.ausgang?.art === 'umbuchung' ? 'a20' : 'a50'} />
						<span class="main"><span class="title">{pos.name}</span><span class="detail">{ausgangText(konf)}</span></span>
						<span class="value">{eur(pos.betragCent)}</span></div></li>
				{/each}
				<li><div class="row total"><span class="main">Zusammen</span><span class="value">{eur(r.gesamtCent)}</span></div></li>
			</ul>
		{/if}
	</div>
	{#if !positionenOffen && ausgaenge.length}
		<div class="card" style="margin-top:14px">
			<ul class="rows">
				{#each ausgaenge as a (a.name)}
					<li><div class="row"><span class="icon neutral">{a.tag ?? '–'}</span>
						<span class="main"><span class="title">{a.name}</span><span class="detail">{a.text}</span></span>
						<span class="value">−{eur(a.betragCent)}</span></div></li>
				{/each}
				<li><div class="row total"><span class="main">Bleibt auf dem Konto<span class="detail">für Alltag und gemeinsame Fixkosten</span></span><span class="value">{eur(eingang - ausgaengeSumme)}</span></div></li>
			</ul>
		</div>
		<p class="note">Eingang: {eur(eingang)} von euch beiden. Darunter steht, was davon am Monatsanfang wieder rausgeht.</p>
	{/if}
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

<style>
	.position { border: 0; margin: 0; }
	.position legend { padding: 0; margin-bottom: 6px; }
	.position select, .rundung select { font-size: 15px; background: var(--fill); border: 2px solid transparent; border-radius: 10px; padding: 8px 10px; min-height: 44px; color: var(--label); }
	.position .tag { max-width: 80px; }
	.position .inline-fields { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
	.berechnet { align-self: center; }
	.entfernen { justify-self: start; color: var(--warm); }
	.buttons { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; }
	.rundung { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; font-size: 15px; color: var(--secondary); }
</style>
