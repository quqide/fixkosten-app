<script lang="ts">
	import AuftragListe from '#lib/components/AuftragListe.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import KontenWahl from '#lib/components/KontenWahl.svelte';
	import RuecklageListe from '#lib/components/RuecklageListe.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Vorschläge fürs Zielkonto der Daueraufträge und das Ziel der Rücklagen. */
	const ziele = $derived([
		...new Set([...data.rueckstellungen.map((r) => r.eintrag.wkn || r.eintrag.zielkonto || ''), ...data.auftraege.map((a) => a.zielkonto)].filter(Boolean))
	]);
</script>

<svelte:head><title>Mein Plan · Fixkosten</title></svelte:head>

<h1>Mein Plan</h1>
<p class="lead">Wohin dein Gehalt jeden Monat geht.</p>

<a class="rechner" href="/rechner">
	<Icon name="rechner" size={22} />
	<span><strong>Was wäre, wenn …?</strong><span>Neues Gehalt oder neuer Vertrag durchrechnen</span></span>
	<span class="chev"><Icon name="pfeil" size={14} /></span>
</a>

<section class="section" aria-labelledby="konten-titel">
	<div class="section-head"><h2 id="konten-titel">Konten</h2></div>
	<div class="card"><KontenWahl modus={data.modus} /></div>
</section>

<section class="section" aria-labelledby="auftraege-titel">
	<div class="section-head"><h2 id="auftraege-titel">Daueraufträge</h2><span class="aside">am {data.ueberweisungstag}. vom Gehaltskonto</span></div>
	<div class="card"><AuftragListe auftraege={data.auftraege} basis={data.planBasis} {ziele} /></div>
	<datalist id="ziele">{#each ziele as z (z)}<option value={z}></option>{/each}</datalist>
	<p class="note">Die Beträge rechnet die App jeden Monat neu aus. „Was übrig bleibt“ gleicht alle Rundungen aus.</p>
</section>

<section class="section" aria-labelledby="ruecklagen-titel">
	<div class="section-head"><h2 id="ruecklagen-titel">Rücklagen</h2><span class="aside">gehen jeden Monat raus</span></div>
	<div class="card"><RuecklageListe rueckstellungen={data.rueckstellungen} kategorien={data.ausgabeKategorien} /></div>
</section>

<style>
	.rechner { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 14px 16px; border: 1px dashed color-mix(in srgb, var(--tint) 45%, transparent);
		background: var(--tint-soft); border-radius: 18px; color: var(--tint); text-decoration: none; margin-top: 8px; }
	.rechner > span:nth-child(2) { flex: 1; min-width: 0; color: var(--label); }
	.rechner strong { display: block; }
	.rechner span span { display: block; font-size: 14px; color: var(--secondary); }
	.rechner:hover { background: color-mix(in srgb, var(--tint-soft) 70%, var(--surface)); }
</style>
