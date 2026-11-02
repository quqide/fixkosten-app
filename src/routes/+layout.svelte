<script lang="ts">
	import '@fontsource-variable/figtree';
	import '../app.css';
	import { page } from '$app/state';
	import PersonMenue from '#lib/components/PersonMenue.svelte';
	import TabLeiste from '#lib/components/TabLeiste.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import { themeCss } from '#lib/themes.ts';
	import { rueckgaengig, toast } from '#lib/toast.svelte.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Farbthema der gewählten Person auch nach Änderungen ohne Neuladen anwenden.
	$effect(() => {
		const root = document.documentElement;
		if (!data.ich) return;
		root.dataset.palette = data.ich.theme;
		if (data.ich.hell === 'auto') delete root.dataset.theme;
		else root.dataset.theme = data.ich.hell;
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<title>Fixkosten</title>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<style>${themeCss}</style>`}
</svelte:head>

<div class="app">
	{#if data.ich}
		<header class="topbar">
			<a class="brand" href="/">
				<Logo size={32} />Fixkosten
			</a>
			<PersonMenue ich={data.ich} personen={data.personen} festePerson={data.festePerson} />
		</header>
		<TabLeiste pfad={page.url.pathname} lage="oben" />
	{/if}

	<main>{@render children()}</main>
</div>

{#if data.ich}
	<TabLeiste pfad={page.url.pathname} lage="unten" />
{/if}

{#if toast.sichtbar}
	<div class="toast" role="status">
		<span>{toast.text}</span>
		{#if toast.undoId != null}<button type="button" onclick={rueckgaengig}>Rückgängig</button>{/if}
	</div>
{/if}

<style>
	.topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; color: var(--label); text-decoration: none; min-height: 44px; }
</style>
