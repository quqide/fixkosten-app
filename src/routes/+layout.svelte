<script lang="ts">
	import '@fontsource-variable/figtree';
	import '../app.css';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import { themeCss } from '#lib/themes.ts';
	import { rueckgaengig, toast } from '#lib/toast.svelte.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const seiten = [
		{ pfad: '/', name: 'Übersicht', icon: 'uebersicht' },
		{ pfad: '/fixkosten', name: 'Fixkosten', icon: 'fixkosten' },
		{ pfad: '/gemeinsam', name: 'Gemeinsam', icon: 'gemeinsam' },
		{ pfad: '/einstellungen', name: 'Einstellungen', icon: 'einstellungen' }
	];

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
			{#if !data.festePerson}
				<form class="who" method="POST" action="/wer?/waehlen" use:enhance aria-label="Wer bist du?">
					{#each data.personen as p (p.id)}
						<button type="submit" name="person" value={p.id} aria-pressed={p.id === data.ich.id}>
							<span class="avatar {p.id}">{p.name.charAt(0).toUpperCase()}</span><span class="name">{p.name}</span>
						</button>
					{/each}
				</form>
			{:else}
				<span class="who"><span class="avatar {data.ich.id}">{data.ich.name.charAt(0)}</span>{data.ich.name}</span>
			{/if}
		</header>
		<nav class="tabs-top" aria-label="Bereiche">
			{#each seiten as s (s.pfad)}
				<a href={s.pfad} aria-current={page.url.pathname === s.pfad ? 'page' : undefined}><Icon name={s.icon} size={18} />{s.name}</a>
			{/each}
		</nav>
	{/if}

	<main>{@render children()}</main>
</div>

{#if data.ich}
	<nav class="tabs-bottom" aria-label="Bereiche">
		{#each seiten as s (s.pfad)}
			<a href={s.pfad} aria-current={page.url.pathname === s.pfad ? 'page' : undefined}>
				<span class="pill"><Icon name={s.icon} size={22} /></span>{s.name}
			</a>
		{/each}
	</nav>
{/if}

{#if toast.sichtbar}
	<div class="toast" role="status">
		<span>{toast.text}</span>
		{#if toast.undoId != null}<button type="button" onclick={rueckgaengig}>Rückgängig</button>{/if}
	</div>
{/if}

<style>
	.topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
	.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; color: var(--label); text-decoration: none; }
	.who { display: flex; gap: 6px; align-items: center; font-weight: 600; }
	.who button { display: flex; align-items: center; gap: 8px; border: 1px solid transparent; background: none; border-radius: 999px; padding: 4px 12px 4px 4px; min-height: 40px; cursor: pointer; color: var(--secondary); font-weight: 500; }
	.who button[aria-pressed='true'] { background: var(--surface); border-color: var(--separator); color: var(--label); box-shadow: var(--shadow); }
	.who button .avatar { opacity: 0.55; }
	.who button[aria-pressed='true'] .avatar { opacity: 1; }
	.tabs-top { display: flex; gap: 4px; margin-top: 16px; background: var(--fill); border-radius: 14px; padding: 4px; }
	.tabs-top a { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; border-radius: 10px; color: var(--secondary); text-decoration: none; font-weight: 600; font-size: 15px; }
	.tabs-top a[aria-current='page'] { background: var(--surface); color: var(--tint); box-shadow: var(--shadow); }
	.tabs-bottom { display: none; }
	@media (max-width: 640px) {
		.tabs-top { display: none; }
		.who .name { display: none; }
		.who button { padding-right: 4px; }
		.tabs-bottom { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 5;
			background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
			border-top: 1px solid var(--separator);
			padding: 6px max(8px, env(safe-area-inset-right, 0px)) calc(6px + env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px)); }
		.tabs-bottom a { flex: 1; display: grid; justify-items: center; gap: 3px; min-height: 52px; padding-top: 4px; color: var(--secondary); text-decoration: none; font-size: 12px; font-weight: 600; }
		.pill { display: grid; place-items: center; width: 52px; height: 30px; border-radius: 999px; }
		.tabs-bottom a[aria-current='page'] { color: var(--tint); }
		.tabs-bottom a[aria-current='page'] .pill { background: var(--tint-soft); }
	}
</style>
