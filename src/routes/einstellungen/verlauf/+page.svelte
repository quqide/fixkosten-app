<script lang="ts">
	import { zeitpunkt } from '#lib/format.ts';
	import { rueckgaengig, toast } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	async function verlaufRueckgaengig(id: number) {
		toast.undoId = id;
		await rueckgaengig();
	}
</script>

<svelte:head><title>Letzte Änderungen · Fixkosten</title></svelte:head>

<a class="zurueck" href="/einstellungen"><span aria-hidden="true">‹</span> Einstellungen</a>
<h1>Letzte Änderungen</h1>
<p class="lead">Von euch beiden, die neueste zuerst.</p>

{#if data.verlauf.length}
	<div class="card"><ul class="rows">
		{#each data.verlauf as a (a.id)}
			<li><div class="row">
				<span class="avatar klein {a.person}">{data.namen[a.person]?.charAt(0)}</span>
				<span class="main"><span class="title">{a.text}</span><span class="detail">{data.namen[a.person]}, {zeitpunkt(a.zeit)}</span></span>
				{#if a.kannRueckgaengig}<button type="button" class="textlink" onclick={() => verlaufRueckgaengig(a.id)}>Rückgängig</button>{/if}
			</div></li>
		{/each}
	</ul></div>
{:else}
	<p class="note">Noch keine Änderungen.</p>
{/if}
