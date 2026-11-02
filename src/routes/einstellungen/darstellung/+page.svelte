<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import { THEMES } from '#lib/themes.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hellOptionen = [
		{ wert: 'auto', name: 'Automatisch' },
		{ wert: 'light', name: 'Hell' },
		{ wert: 'dark', name: 'Dunkel' }
	];
</script>

<svelte:head><title>Darstellung · Fixkosten</title></svelte:head>

<a class="zurueck" href="/einstellungen"><span aria-hidden="true">‹</span> Einstellungen</a>
<h1>Darstellung</h1>
<p class="lead">Farbthema und hell oder dunkel. Wirkt sofort.</p>

<form method="POST" action="?/darstellung" use:enhance={() => async ({ update }) => update({ reset: false })} class="section">
	<div class="swatches">
		{#each Object.entries(THEMES) as [id, t] (id)}
			<label class="swatch">
				<input type="radio" name="theme" value={id} checked={data.theme === id} onchange={(e) => e.currentTarget.form?.requestSubmit()} />
				<span class="preview" aria-hidden="true">
					<span style="background:{t.hell.tint}"></span><span style="background:{t.hell.tintSoft}"></span><span style="background:{t.dunkel.surface}"></span>
				</span>
				<strong>{t.name}<span class="haken" aria-hidden="true"><Icon name="haken" size={12} /></span></strong>
			</label>
		{/each}
	</div>
	<div class="modes" role="radiogroup" aria-label="Hell oder dunkel">
		{#each hellOptionen as h (h.wert)}
			<label><input type="radio" name="hell" value={h.wert} checked={data.hell === h.wert} onchange={(e) => e.currentTarget.form?.requestSubmit()} />{h.name}</label>
		{/each}
	</div>
	<noscript><button class="secondary" type="submit">Übernehmen</button></noscript>
	<p class="note">„Automatisch“ folgt der Einstellung deines Geräts. Jede Person hat ihr eigenes Farbthema.</p>
</form>

<style>
	.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
	.swatch { border: 2px solid var(--separator); background: var(--surface); border-radius: 14px; padding: 12px; cursor: pointer; display: grid; gap: 10px; }
	.swatch:has(input:checked) { border-color: var(--tint); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tint) 20%, transparent); }
	.swatch:has(input:focus-visible), .modes label:has(input:focus-visible) { outline: 3px solid color-mix(in srgb, var(--tint) 60%, transparent); outline-offset: 2px; }
	.swatch input, .modes input { position: absolute; opacity: 0; pointer-events: none; }
	.preview { display: flex; height: 34px; border-radius: 9px; overflow: hidden; }
	.preview span { flex: 1; }
	.preview span:first-child { flex: 2; }
	.swatch strong { font-size: 15px; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
	.haken { width: 20px; height: 20px; border-radius: 50%; background: var(--tint); color: var(--surface); display: none; place-items: center; }
	.swatch:has(input:checked) .haken { display: grid; }
	.modes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; background: var(--fill); border-radius: 14px; padding: 4px; margin-top: 14px; }
	.modes label { border-radius: 10px; min-height: 44px; font-weight: 600; color: var(--secondary); cursor: pointer; display: grid; place-items: center; }
	.modes label:has(input:checked) { background: var(--surface); color: var(--label); box-shadow: var(--shadow); }
</style>
