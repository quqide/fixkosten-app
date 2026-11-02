<script lang="ts">
	import { enhance } from '$app/forms';
	import { mitRueckmeldung } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	const fehler = $derived((form?.fehler ?? {}) as Record<string, string>);
	const fehlerIn = (bereich: string) => (form?.bereich === bereich ? fehler : {});

	let importBestaetigen = $state(false);
</script>

<svelte:head><title>Deine Daten · Fixkosten</title></svelte:head>

<a class="zurueck" href="/einstellungen"><span aria-hidden="true">‹</span> Einstellungen</a>
<h1>Deine Daten</h1>
<p class="lead">Sicherung herunterladen oder einspielen.</p>

<div class="section">
	<div class="card">
		<div class="field">
			<span class="label">Sicherung</span>
			<span class="help">Lädt alle Daten von euch beiden als Datei herunter. Damit kannst du sie später wieder einspielen.</span>
			<a class="secondary" href="/export" download>Sicherung herunterladen</a>
		</div>
		<form class="field" method="POST" action="?/import" enctype="multipart/form-data" use:enhance={mitRueckmeldung(() => (importBestaetigen = false))}>
			<label for="datei">Sicherung einspielen</label>
			<input id="datei" name="datei" type="file" accept="application/json,.json" />
			{#if fehlerIn('import').datei}<span class="error">{fehlerIn('import').datei}</span>{/if}
			{#if importBestaetigen}
				<span class="error">Das ersetzt alle aktuellen Daten von euch beiden. Wirklich einspielen?</span>
				<div class="inline-fields">
					<button type="button" class="secondary" onclick={() => (importBestaetigen = false)}>Abbrechen</button>
					<button type="submit" class="primary">Ja, ersetzen</button>
				</div>
			{:else}
				<button type="button" class="secondary" onclick={() => (importBestaetigen = true)}>Einspielen …</button>
			{/if}
		</form>
	</div>
</div>

<style>
	input[type='file'] { background: none !important; padding-left: 0 !important; }
</style>
