<script lang="ts">
	import Sheet from '../Sheet.svelte';

	let { gespeichert }: { gespeichert: (wert: string) => void } = $props();
	let offen = $state(false);
</script>

<button type="button" id="ausloeser" onclick={() => (offen = true)}>Bearbeiten</button>
<Sheet {offen} titel="Probe" formular="probe-form" onabbrechen={() => (offen = false)}>
	<form
		id="probe-form"
		onsubmit={(e) => {
			e.preventDefault();
			gespeichert(new FormData(e.currentTarget).get('name') as string);
			offen = false;
		}}
	>
		<input name="name" value="Netflix" aria-label="Name" />
		<details><summary>Mehr</summary><input name="versteckt" aria-label="Versteckt" /></details>
		<button type="button" id="letzter">Löschen</button>
	</form>
</Sheet>
