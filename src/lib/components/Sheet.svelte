<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Gemeinsames Bearbeitungsfenster: Kopfzeile mit „Abbrechen“, Titel und „Fertig“.
	 * Am Handy von unten eingeblendet, am Rechner als Fenster in der Mitte.
	 * „Fertig“ schickt das Formular `formular` ab (oder ruft `onfertig` auf), Abbrechen und
	 * Escape rufen `onabbrechen` auf, ohne zu speichern. Geöffnet ist es, solange `offen` gilt.
	 */
	let {
		offen,
		titel,
		formular,
		onfertig,
		onabbrechen,
		fertigText = 'Fertig',
		children
	}: {
		offen: boolean;
		titel: string;
		/** id des Formulars, das „Fertig“ abschickt. */
		formular?: string;
		onfertig?: () => void;
		onabbrechen: () => void;
		fertigText?: string;
		children: Snippet;
	} = $props();

	const id = $props.id();
	let dialog: HTMLDialogElement;
	/** Element, das vor dem Öffnen den Fokus hatte; bekommt ihn danach zurück. */
	let ausloeser: HTMLElement | null = null;

	const FOKUSSIERBAR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

	/** Was per Tab erreichbar ist: nichts in versteckten Teilen oder zugeklappten Abschnitten. */
	function fokusZiele(): HTMLElement[] {
		return [...dialog.querySelectorAll<HTMLElement>(FOKUSSIERBAR)].filter((el) => {
			if (el.closest('[hidden]')) return false;
			const zu = el.closest('details:not([open])');
			return !zu || (el.tagName === 'SUMMARY' && el.parentElement === zu);
		});
	}

	$effect(() => {
		if (offen && !dialog.open) {
			ausloeser = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			dialog.showModal();
			// Wie beim nativen Dialog: Fokus auf das erste Bedienelement, hier „Abbrechen“.
			fokusZiele()[0]?.focus();
		} else if (!offen && dialog.open) {
			dialog.close();
			if (ausloeser?.isConnected) ausloeser.focus();
			ausloeser = null;
		}
	});

	function tasten(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onabbrechen();
			return;
		}
		if (e.key !== 'Tab') return;
		const ziele = fokusZiele();
		if (!ziele.length) return;
		const erstes = ziele[0];
		const letztes = ziele[ziele.length - 1];
		const aktiv = document.activeElement;
		if (!dialog.contains(aktiv) || (e.shiftKey && aktiv === erstes)) {
			e.preventDefault();
			(e.shiftKey ? letztes : erstes).focus();
		} else if (!e.shiftKey && aktiv === letztes) {
			e.preventDefault();
			erstes.focus();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -- Tastatur gehört zum Dialog selbst -->
<dialog
	bind:this={dialog}
	class="sheet"
	aria-modal="true"
	aria-labelledby="{id}-titel"
	onkeydown={tasten}
	oncancel={(e) => {
		e.preventDefault();
		onabbrechen();
	}}
	onclose={() => {
		if (offen) onabbrechen();
	}}
>
	{#if offen}
		<div class="griff" aria-hidden="true"></div>
		<div class="sheet-kopf">
			<button type="button" class="sheet-knopf" onclick={onabbrechen}>Abbrechen</button>
			<h2 id="{id}-titel">{titel}</h2>
			{#if formular}
				<button type="submit" class="sheet-knopf fertig" form={formular}>{fertigText}</button>
			{:else}
				<button type="button" class="sheet-knopf fertig" onclick={onfertig}>{fertigText}</button>
			{/if}
		</div>
		<div class="sheet-inhalt">{@render children()}</div>
	{/if}
</dialog>

<style>
	.sheet { display: none; flex-direction: column; overflow: hidden; }
	.sheet[open] { display: flex; }
	.griff { align-self: center; width: 40px; height: 5px; border-radius: 3px; background: var(--separator); margin-top: 8px; flex: none; }
	.sheet-kopf {
		display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 8px;
		padding: 4px 8px; border-bottom: 1px solid var(--separator); flex: none;
	}
	.sheet-kopf h2 { font: 700 17px/1.3 var(--font); margin: 0; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60vw; }
	.sheet-knopf {
		border: 0; background: none; color: var(--tint); font: 500 16px/1 var(--font); min-height: 44px; min-width: 44px;
		padding: 0 12px; cursor: pointer; justify-self: start; border-radius: 10px;
	}
	.sheet-knopf.fertig { font-weight: 700; justify-self: end; }
	.sheet-inhalt { overflow-y: auto; overscroll-behavior: contain; }
	@media (max-width: 640px) {
		.sheet { margin: auto 0 0; width: 100%; max-width: 100%; max-height: 92dvh; border-radius: 22px 22px 0 0; padding-bottom: env(safe-area-inset-bottom, 0px); }
		.sheet[open] { animation: von-unten 0.25s ease-out; }
	}
	@media (min-width: 641px) {
		.griff { display: none; }
		.sheet-kopf { padding-top: 8px; }
	}
	@keyframes von-unten { from { transform: translateY(100%); } to { transform: none; } }
	@media (prefers-reduced-motion: reduce) { .sheet[open] { animation: none; } }
</style>
