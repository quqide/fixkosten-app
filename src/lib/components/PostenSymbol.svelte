<script lang="ts">
	import { initiale } from '#lib/format.ts';
	import { iconFuer, POSTEN_ICONS } from '#lib/postenIcons.ts';

	let { name, icon = null, klasse = '' }: { name: string; icon?: string | null; klasse?: string } = $props();
	const gewaehlt = $derived(iconFuer(name, icon));
</script>

<span class="icon {klasse}">
	{#if gewaehlt}
		<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- feste Pfade aus postenIcons.ts -->
			{@html POSTEN_ICONS[gewaehlt].svg}
		</svg>
	{:else}
		{initiale(name)}
	{/if}
</span>
