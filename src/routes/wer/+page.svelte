<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const standardnamen = $derived(data.personen.every((p) => /^Person \d$/.test(p.name)));
</script>

<svelte:head><title>Wer bist du? · Fixkosten</title></svelte:head>

<div class="wer">
	<h1>Wer bist du?</h1>
	<p class="lead">Wähle dich aus, damit du deine eigenen Fixkosten siehst. Ihr könnt jederzeit oben rechts wechseln.</p>
	<form method="POST" action="?/waehlen" class="auswahl">
		{#each data.personen as p (p.id)}
			<button type="submit" name="person" value={p.id} class="card">
				<span class="avatar {p.id} gross">{p.name.charAt(0).toUpperCase()}</span>
				<strong>{p.name}</strong>
			</button>
		{/each}
	</form>
	{#if standardnamen}
		<p class="note">Eure Namen könnt ihr danach in den Einstellungen eintragen.</p>
	{/if}
</div>

<style>
	.wer { max-width: 520px; margin: 8vh auto 0; text-align: center; }
	.lead { margin-inline: auto; }
	.auswahl { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
	.auswahl button { border: 2px solid transparent; padding: 28px 16px; display: grid; justify-items: center; gap: 12px; cursor: pointer; font-size: 18px; }
	.auswahl button:hover { border-color: var(--tint); }
	.gross { width: 64px; height: 64px; font-size: 26px; }
</style>
