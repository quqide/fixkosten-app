<script lang="ts">
	import { aktiverBereich, BEREICHE } from '#lib/navigation.ts';
	import Icon from './Icon.svelte';

	/** `oben` am Rechner, `unten` am Handy; welche sichtbar ist, regelt das CSS im Layout. */
	let { pfad, lage }: { pfad: string; lage: 'oben' | 'unten' } = $props();
	const aktiv = $derived(aktiverBereich(pfad));
</script>

<nav class={lage === 'oben' ? 'tabs-top' : 'tabs-bottom'} aria-label="Bereiche">
	{#each BEREICHE as b (b.pfad)}
		<a href={b.pfad} aria-current={aktiv === b.pfad ? 'page' : undefined}>
			{#if lage === 'oben'}<Icon name={b.icon} size={18} />{b.name}
			{:else}<span class="pill"><Icon name={b.icon} size={22} /></span>{b.name}{/if}
		</a>
	{/each}
</nav>

<style>
	.tabs-top { display: flex; gap: 4px; margin-top: 16px; background: var(--fill); border-radius: 14px; padding: 4px; }
	.tabs-top a { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border-radius: 10px; color: var(--secondary); text-decoration: none; font-weight: 600; font-size: 15px; }
	.tabs-top a[aria-current='page'] { background: var(--surface); color: var(--tint); box-shadow: var(--shadow); }
	.tabs-bottom { display: none; }
	@media (max-width: 640px) {
		.tabs-top { display: none; }
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
