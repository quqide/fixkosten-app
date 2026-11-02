<script lang="ts">
	import { enhance } from '$app/forms';

	/**
	 * Runder Personen-Knopf rechts in der Kopfzeile. Öffnet ein kleines Menü mit „Einstellungen“
	 * und, wenn die Person nicht fest eingestellt ist, dem Wechsel zur anderen Person.
	 */
	let {
		ich,
		personen,
		festePerson = false
	}: {
		ich: { id: string; name: string };
		personen: { id: string; name: string }[];
		festePerson?: boolean;
	} = $props();

	const id = $props.id();
	let offen = $state(false);
	let wurzel: HTMLDivElement;
	let knopf: HTMLButtonElement;

	const initiale = (name: string) => name.charAt(0).toUpperCase();

	function schliessen(fokusZurueck = false) {
		offen = false;
		if (fokusZurueck) knopf.focus();
	}

	// Klick oder Tippen außerhalb schließt das Menü.
	$effect(() => {
		if (!offen) return;
		const aussen = (e: PointerEvent) => {
			if (!wurzel.contains(e.target as Node)) schliessen();
		};
		document.addEventListener('pointerdown', aussen);
		return () => document.removeEventListener('pointerdown', aussen);
	});

	function taste(e: KeyboardEvent) {
		if (e.key === 'Escape' && offen) {
			e.preventDefault();
			schliessen(true);
		}
	}

	// Fokus verlässt das Menü (Tab weiter): schließen.
	function fokusRaus(e: FocusEvent) {
		if (offen && e.relatedTarget && !wurzel.contains(e.relatedTarget as Node)) schliessen();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="person" bind:this={wurzel} onkeydown={taste} onfocusout={fokusRaus}>
	<button
		type="button"
		class="avatar-knopf"
		bind:this={knopf}
		aria-expanded={offen}
		aria-controls="{id}-menue"
		aria-label="{ich.name}: Einstellungen{festePerson ? '' : ' und Person wechseln'}"
		onclick={() => (offen = !offen)}
	>
		<span class="avatar {ich.id}">{initiale(ich.name)}</span>
	</button>
	<div class="menue" id="{id}-menue" hidden={!offen}>
		<p class="wer">{ich.name}</p>
		<a href="/einstellungen" onclick={() => schliessen()}>Einstellungen</a>
		{#if !festePerson}
			<form method="POST" action="/wer?/waehlen" use:enhance={() => async ({ update }) => { schliessen(); await update(); }}>
				<p class="label" id="{id}-wechsel">Person wechseln</p>
				<div role="group" aria-labelledby="{id}-wechsel">
					{#each personen as p (p.id)}
						<button type="submit" name="person" value={p.id} aria-pressed={p.id === ich.id}>
							<span class="avatar klein {p.id}">{initiale(p.name)}</span>{p.name}
						</button>
					{/each}
				</div>
			</form>
		{/if}
	</div>
</div>

<style>
	.person { position: relative; }
	.avatar-knopf { width: 44px; height: 44px; border-radius: 50%; border: 0; background: none; padding: 0; display: grid; place-items: center; cursor: pointer; }
	.avatar-knopf .avatar { width: 38px; height: 38px; box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--separator); }
	.avatar-knopf[aria-expanded='true'] .avatar { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--tint); }
	.menue { position: absolute; right: 0; top: calc(100% + 8px); z-index: 20; min-width: 220px; max-width: calc(100vw - 32px);
		background: var(--surface); border: 1px solid var(--separator); border-radius: 16px; box-shadow: var(--shadow); padding: 6px; display: grid; }
	.menue[hidden] { display: none; }
	.wer { margin: 0; padding: 8px 12px 6px; font-weight: 700; }
	.menue a, .menue button { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px; border-radius: 10px; border: 0; background: none;
		width: 100%; text-align: left; color: var(--label); text-decoration: none; font: inherit; font-weight: 500; cursor: pointer; }
	.menue a:hover, .menue button:hover { background: var(--fill); }
	.menue form { border-top: 1px solid var(--separator); margin-top: 6px; padding-top: 6px; }
	.menue .label { margin: 0; padding: 6px 12px 2px; font-size: 13px; color: var(--secondary); font-weight: 600; }
	.menue button[aria-pressed='true'] { font-weight: 700; }
	.menue button[aria-pressed='true']::after { content: '✓'; margin-left: auto; color: var(--tint); }
	.menue button[aria-pressed='false'] .avatar { opacity: 0.6; }
</style>
