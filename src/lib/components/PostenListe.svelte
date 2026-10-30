<script lang="ts">
	import type { FixkostenPosten, Zeile } from '#lib/rechnung/fixkosten.ts';
	import type { Warnung } from '#lib/rechnung/terminplan.ts';
	import { datumKnapp, eur, intervallText } from '#lib/format.ts';
	import PostenSymbol from './PostenSymbol.svelte';
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
		eintraege: Eintrag<FixkostenPosten & { id?: number; actualTerminplan?: string | null; meldungen?: Warnung[] }>[];
		bearbeiten: (p: FixkostenPosten & { id?: number; actualTerminplan?: string | null; meldungen?: Warnung[] }) => void;
	} = $props();

	const summe = $derived(
		eintraege.reduce((s, e) => s + e.zeile.monatlichCent + e.beteiligungen.reduce((t, b) => t + b.monatlichCent, 0), 0)
	);
	/** Zugänglicher Name des Symbols, z. B. „1 Warnung, 2 Hinweise“. */
	function meldungenText(m: Warnung[]) {
		const w = m.filter((x) => x.stufe === 'warnung').length;
		const h = m.length - w;
		return [w && `${w} ${w === 1 ? 'Warnung' : 'Warnungen'}`, h && `${h} ${h === 1 ? 'Hinweis' : 'Hinweise'}`].filter(Boolean).join(', ');
	}
	const artKlasse = (art: string | null | undefined) => `a${art?.slice(0, 2) ?? '50'}`;
</script>

<ul class="rows">
	{#each eintraege as e (e.posten.id)}
		<li>
			<button type="button" class="row" onclick={() => bearbeiten(e.posten)}>
				<PostenSymbol name={e.posten.name} icon={e.posten.icon} klasse={artKlasse(e.posten.art)} />
				<span class="main">
					<span class="title">{e.posten.name}</span>
					<span class="detail">
						{eur(e.posten.betragCent)} {intervallText(e.posten.intervallMonate)}{#if e.zeile.naechsteBuchung}{' · '}{datumKnapp(e.zeile.naechsteBuchung)}{/if}{#if e.posten.actualTerminplan}{' · '}<span class="quelle">Actual</span>{#if e.posten.meldungen?.length}{' '}<span
									class="meldung"
									class:warnung={e.posten.meldungen.some((m) => m.stufe === 'warnung')}
									role="img"
									aria-label={meldungenText(e.posten.meldungen)}
									title={meldungenText(e.posten.meldungen)}>{e.posten.meldungen.some((m) => m.stufe === 'warnung') ? '!' : 'i'}</span>{/if}{/if}
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
	.meldung {
		display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%;
		font-size: 11px; font-weight: 800; vertical-align: 1px; background: var(--calm-soft); color: var(--calm);
	}
	.meldung.warnung { background: var(--warm-soft); color: var(--warm); }
</style>
