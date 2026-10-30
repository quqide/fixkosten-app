<script lang="ts">
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import PostenDialog from '#lib/components/PostenDialog.svelte';
	import PostenListe from '#lib/components/PostenListe.svelte';
	import { eur, zeitpunkt } from '#lib/format.ts';
	import type { FixkostenPosten } from '#lib/rechnung/fixkosten.ts';
	import type { Warnung } from '#lib/rechnung/terminplan.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const filter = [
		{ wert: '', name: 'Alle', farbe: '' },
		{ wert: '50', name: 'Lebenshaltung', farbe: 'var(--calm)' },
		{ wert: '30', name: 'Freizeit', farbe: 'var(--violet)' },
		{ wert: '20', name: 'Sparen', farbe: 'var(--tint)' }
	];
	const art = $derived(page.url.searchParams.get('art') ?? '');
	const sichtbar = $derived(art ? data.eintraege.filter((e) => e.posten.art?.startsWith(art)) : data.eintraege);
	const summe = $derived(data.eintraege.reduce((s, e) => s + e.zeile.monatlichCent + e.beteiligungen.reduce((t, b) => t + b.monatlichCent, 0), 0));

	let bearbeitet = $state<(FixkostenPosten & { id?: number; meldungen?: Warnung[] }) | null>(null);
	const neu = () => (bearbeitet = { name: '', betragCent: 0, intervallMonate: 1, art: '30 (Freizeit)', beteiligungen: [] });

	// Link „Erste Fixkosten anlegen“ öffnet direkt den Dialog.
	$effect(() => {
		if (page.url.searchParams.has('neu')) {
			neu();
			const url = new URL(page.url.href);
			url.searchParams.delete('neu');
			replaceState(url, {});
		}
	});
</script>

<svelte:head><title>Fixkosten · {data.person.name}</title></svelte:head>

<h1>Deine Fixkosten</h1>
{#if data.eintraege.length}
	<p class="lead">{data.eintraege.length} regelmäßige Zahlungen. Dafür legst du {eur(summe)} im Monat zurück.</p>
	<nav class="chips" aria-label="Nach Art filtern">
		{#each filter as f (f.wert)}
			<a class="chip" href={f.wert ? `?art=${f.wert}` : '?'} aria-current={art === f.wert ? 'true' : undefined} data-sveltekit-noscroll>
				{#if f.farbe}<span class="dot" style="background:{f.farbe}"></span>{/if}{f.name}
			</a>
		{/each}
	</nav>
	<div class="card" style="margin-top:14px">
		{#if sichtbar.length}
			<PostenListe eintraege={sichtbar} bearbeiten={(p) => (bearbeitet = p)} />
		{:else}
			<p class="empty">In dieser Kategorie gibt es noch nichts.</p>
		{/if}
	</div>
	<p class="note">Grün hinterlegt: Geld, das andere dir für ihren Anteil überweisen. Es senkt deine Rücklage.</p>
{:else}
	<p class="lead">Hier sammelst du alles, was regelmäßig abgebucht wird.</p>
	<div class="card empty">
		<h2>Noch keine Fixkosten</h2>
		<p>Fang mit der größten Zahlung an, zum Beispiel einer Versicherung. Ein Abbuchungsdatum genügt, den Rest rechnet die App.</p>
	</div>
{/if}

<div style="margin-top:18px">
	<button type="button" class="primary wide" onclick={neu}><Icon name="plus" size={18} />Neue Fixkosten anlegen</button>
</div>
{#if data.letzte}<p class="note">Zuletzt {zeitpunkt(data.letzte.zeit)}: {data.letzte.text}</p>{/if}

<PostenDialog bind:posten={bearbeitet} />
