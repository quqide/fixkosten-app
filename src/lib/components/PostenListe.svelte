<script lang="ts">
	import type { FixkostenPosten, Zeile } from '#lib/rechnung/fixkosten.ts';
	import { datumKnapp, eur, initiale, intervallText } from '#lib/format.ts';
	import Icon from './Icon.svelte';

	interface Eintrag<P> {
		posten: P;
		zeile: Zeile;
		beteiligungen: Zeile[];
	}

	let {
		eintraege,
		bearbeiten
	}: {
		eintraege: Eintrag<FixkostenPosten & { id?: number; actualTerminplan?: string | null }>[];
		bearbeiten: (p: FixkostenPosten & { id?: number; actualTerminplan?: string | null }) => void;
	} = $props();

	const summe = $derived(
		eintraege.reduce((s, e) => s + e.zeile.monatlichCent + e.beteiligungen.reduce((t, b) => t + b.monatlichCent, 0), 0)
	);
	const artKlasse = (art: string | null | undefined) => `a${art?.slice(0, 2) ?? '50'}`;
</script>

<ul class="rows">
	{#each eintraege as e (e.posten.id)}
		<li>
			<button type="button" class="row" onclick={() => bearbeiten(e.posten)}>
				<span class="icon {artKlasse(e.posten.art)}">{initiale(e.posten.name)}</span>
				<span class="main">
					<span class="title">{e.posten.name}</span>
					<span class="detail">
						{eur(e.posten.betragCent)} {intervallText(e.posten.intervallMonate)}{#if e.zeile.naechsteBuchung}{' · '}{datumKnapp(e.zeile.naechsteBuchung)}{/if}{#if e.posten.actualTerminplan}{' · '}<span class="quelle">Actual</span>{/if}
					</span>
				</span>
				<span class="value">{eur(e.zeile.monatlichCent)}<small>pro Monat</small></span>
				<span class="chev"><Icon name="pfeil" size={14} /></span>
			</button>
			{#if e.beteiligungen.length}
				<ul class="share" aria-label="Anteile anderer an {e.posten.name}">
					{#each e.beteiligungen as b (b.name)}
						<li><span>{b.name} zahlt dir</span><span class="num">{eur(-b.betragCent)}</span></li>
					{/each}
				</ul>
			{/if}
		</li>
	{/each}
	<li>
		<div class="row total"><span class="main">Pro Monat zurücklegen</span><span class="value">{eur(summe)}</span></div>
	</li>
</ul>

<style>
	.quelle { font-size: 12px; font-weight: 700; color: var(--calm); }
</style>
