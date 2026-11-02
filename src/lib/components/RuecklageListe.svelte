<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { eur } from '#lib/format.ts';
	import {
		artText,
		neuerEntwurf,
		ringAnteil,
		RUECKLAGE_ARTEN,
		zuEntwurf,
		zustand,
		type RuecklageEntwurf,
		type RuecklageMitStand
	} from '#lib/ruecklageAnzeige.ts';
	import { zeigeToast } from '#lib/toast.svelte.ts';
	import Icon from './Icon.svelte';
	import Ring from './Ring.svelte';
	import Sheet from './Sheet.svelte';

	let {
		rueckstellungen,
		kategorien = []
	}: {
		/** Gespeicherte Rücklagen mit ihrem Stand für diesen Monat. */
		rueckstellungen: RuecklageMitStand[];
		/** Ausgabe-Kategorien aus Actual, deren Saldo der Stand sein kann. */
		kategorien?: { id: string; name: string }[];
	} = $props();

	/** Was gerade im Fenster bearbeitet wird; `index` null heißt neu. */
	let bearbeitet = $state<{ index: number | null; entwurf: RuecklageEntwurf } | null>(null);
	let fehler = $state<Record<string, string>>({});
	let laeuft = $state(false);

	function oeffnen(index: number | null) {
		fehler = {};
		bearbeitet = { index, entwurf: index == null ? neuerEntwurf() : zuEntwurf(rueckstellungen[index].eintrag) };
	}
	const schliessen = () => (bearbeitet = null);

	const alle = () => rueckstellungen.map((r) => zuEntwurf(r.eintrag));
	/** Stelle des bearbeiteten Eintrags in der abgeschickten Liste. */
	const position = $derived(bearbeitet ? (bearbeitet.index ?? rueckstellungen.length) : 0);
	const speicherText = $derived.by(() => {
		if (!bearbeitet) return '[]';
		const liste = alle();
		liste.splice(position, bearbeitet.index == null ? 0 : 1, bearbeitet.entwurf);
		return JSON.stringify(liste);
	});
	const loeschText = $derived(bearbeitet?.index != null ? JSON.stringify(alle().filter((_, i) => i !== bearbeitet!.index)) : '[]');
	const gespeichert = $derived(bearbeitet?.index != null ? rueckstellungen[bearbeitet.index] : null);

	const feldFehler = (feld: string) => (fehler[`feld_${position}`] === feld ? fehler[`r_${position}`] : undefined);
	/** Fehler, die zu keinem Feld gehören, oben im Fenster. */
	const obenFehler = $derived(fehler[`r_${position}`] && fehler[`feld_${position}`] ? undefined : (fehler[`r_${position}`] ?? fehler.allgemein));

	const absenden: SubmitFunction = () => {
		laeuft = true;
		return async ({ result, update }) => {
			laeuft = false;
			if (result.type === 'failure') {
				fehler = (result.data?.fehler as Record<string, string>) ?? {};
				return;
			}
			if (result.type === 'error') {
				zeigeToast('Das hat nicht geklappt. Bitte versuch es noch einmal.');
				return;
			}
			await update({ reset: false, invalidateAll: true });
			const daten = result.type === 'success' ? (result.data as { meldung?: string; undoId?: number }) : undefined;
			if (daten?.meldung) zeigeToast(daten.meldung, daten.undoId ?? null);
			schliessen();
		};
	};

	function statusText(s: RuecklageMitStand) {
		if (s.status === 'pausiert') return 'Pausiert, geht diesen Monat nichts drauf.';
		if (s.status === 'erreicht') return 'Ziel erreicht, pausiert sich von selbst, bis wieder Geld fehlt.';
		if (s.status === 'faellig') return 'Fälligkeit ist vorbei.';
		if (s.status === 'unbekannt' && !s.rateCent) return 'Ohne Stand ist diesen Monat keine Rate eingeplant.';
		const rate = `Diesen Monat ${eur(s.rateCent)}`;
		return s.restRaten ? `${rate}, noch ${s.restRaten} ${s.restRaten === 1 ? 'Rate' : 'Raten'}.` : `${rate}.`;
	}
</script>

{#if rueckstellungen.length}
	<ul class="rows">
		{#each rueckstellungen as r, i (r.eintrag.id ?? `neu-${i}`)}
			{@const z = zustand(r)}
			<li>
				<button type="button" class="row" onclick={() => oeffnen(i)}>
					<Ring klein anteil={ringAnteil(r)} farbe="var(--tint)"
						label={r.fortschritt == null ? 'ohne Ziel' : `${Math.round(r.fortschritt * 100)} % vom Ziel`} />
					<span class="main">
						<span class="title">{r.eintrag.name}</span>
						<span class="detail">{artText(r)}</span>
					</span>
					<span class="value">{eur(r.rateCent)}<small class="zustand {z === 'läuft' ? 'laeuft' : z === 'fällig' ? 'faellig' : z}">{z}</small></span>
					<span class="chev"><Icon name="pfeil" size={14} /></span>
				</button>
			</li>
		{/each}
	</ul>
{:else}
	<p class="leer">Zum Beispiel für den Urlaub, die Kfz-Versicherung im März oder den Notgroschen. Die Rate geht über einen Dauerauftrag mit „Rücklagen mit Ziel“ raus.</p>
{/if}
<div class="unten">
	<button type="button" class="secondary" onclick={() => oeffnen(null)}><Icon name="plus" size={18} />Rücklage hinzufügen</button>
</div>

<Sheet offen={bearbeitet != null} titel={bearbeitet?.index == null ? 'Neue Rücklage' : 'Rücklage'} formular="ruecklage-formular" onabbrechen={schliessen}>
	{#if bearbeitet}
		{@const r = bearbeitet.entwurf}
		<form id="ruecklage-formular" method="POST" action="?/rueckstellungen" use:enhance={absenden} novalidate>
			<input type="hidden" name="rueckstellungen" value={speicherText} />
			<div class="sheet-body">
				{#if obenFehler}<p class="note fehler" role="alert">{obenFehler}</p>{/if}
				{#if gespeichert}
					<div class="card stand" aria-live="polite">
						{#if gespeichert.fortschritt != null}
							<div class="balken" role="progressbar" aria-label="Stand zum Ziel" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(gespeichert.fortschritt * 100)}>
								<span style="width:{gespeichert.fortschritt * 100}%"></span>
							</div>
							<span class="help">{eur(gespeichert.standCent ?? 0)} von {eur(gespeichert.zielCent ?? 0)}{gespeichert.standQuelle === 'actual' ? ' (aus Actual)' : ''}</span>
						{/if}
						{#if gespeichert.hinweis}<span class="hinweis">{gespeichert.hinweis}</span>{/if}
						<span class="help">{statusText(gespeichert)}</span>
					</div>
				{/if}
				<div class="card">
					<div class="field">
						<label for="r-name">Wofür?</label>
						<input id="r-name" bind:value={r.name} placeholder="z. B. Notgroschen" autocomplete="off" maxlength="100"
							aria-invalid={!!feldFehler('name')} aria-describedby={feldFehler('name') ? 'r-name-f' : undefined} />
						{#if feldFehler('name')}<span class="error" id="r-name-f">{feldFehler('name')}</span>{/if}
					</div>
					<div class="field">
						<label for="r-art">Art</label>
						<select id="r-art" bind:value={r.art} aria-describedby="r-art-h">
							{#each RUECKLAGE_ARTEN as a (a.wert)}<option value={a.wert}>{a.name}</option>{/each}
						</select>
						<span class="help" id="r-art-h">
							{r.art === 'fest' ? 'Jeden Monat derselbe Betrag.' : r.art === 'faellig' ? 'Die Rate ergibt sich aus Betrag und Fälligkeit.' : 'Ein fester Betrag, bis das Ziel erreicht ist.'}
						</span>
					</div>
					{#if r.art !== 'faellig'}
						<div class="field">
							<label for="r-betrag">Pro Monat</label>
							<input id="r-betrag" bind:value={r.betrag} inputmode="decimal" placeholder="z. B. 200"
								aria-invalid={!!feldFehler('betrag')} aria-describedby={feldFehler('betrag') ? 'r-betrag-f' : undefined} />
							{#if feldFehler('betrag')}<span class="error" id="r-betrag-f">{feldFehler('betrag')}</span>{/if}
						</div>
					{/if}
					{#if r.art === 'ziel'}
						<div class="field">
							<label for="r-ziel">Ziel</label>
							<span class="mit-einheit">
								<input id="r-ziel" bind:value={r.ziel} inputmode="decimal" placeholder={r.zielArt === 'netto' ? 'z. B. 3' : 'z. B. 5000'}
									aria-invalid={!!feldFehler('ziel')} aria-describedby={feldFehler('ziel') ? 'r-ziel-f' : undefined} />
								<select bind:value={r.zielArt} aria-label="Ziel in">
									<option value="betrag">€</option>
									<option value="netto">× Netto</option>
								</select>
							</span>
							{#if feldFehler('ziel')}<span class="error" id="r-ziel-f">{feldFehler('ziel')}</span>{/if}
						</div>
					{:else if r.art === 'faellig'}
						<div class="field">
							<label for="r-ziel">Betrag</label>
							<input id="r-ziel" bind:value={r.ziel} inputmode="decimal" placeholder="z. B. 600"
								aria-invalid={!!feldFehler('ziel')} aria-describedby={feldFehler('ziel') ? 'r-ziel-f' : undefined} />
							{#if feldFehler('ziel')}<span class="error" id="r-ziel-f">{feldFehler('ziel')}</span>{/if}
						</div>
						<div class="field">
							<label for="r-faellig">Fällig am</label>
							<input id="r-faellig" type="date" bind:value={r.faellig}
								aria-invalid={!!feldFehler('faellig')} aria-describedby={feldFehler('faellig') ? 'r-faellig-f' : undefined} />
							{#if feldFehler('faellig')}<span class="error" id="r-faellig-f">{feldFehler('faellig')}</span>{/if}
						</div>
					{/if}
				</div>

				<div class="card">
					<div class="field">
						<label for="r-wohin">Wohin</label>
						<span class="mit-einheit">
							<select bind:value={r.wohinArt} aria-label="Konto oder WKN">
								<option value="konto">Konto</option>
								<option value="wkn">WKN</option>
							</select>
							<input id="r-wohin" bind:value={r.wohin} list="ziele" autocomplete="off" placeholder={r.wohinArt === 'wkn' ? 'z. B. A0RPWH' : 'z. B. Tagesgeld'} />
						</span>
					</div>
					{#if r.art !== 'fest'}
						{#if kategorien.length || r.kategorie}
							<div class="field">
								<label for="r-kategorie">Stand aus</label>
								<select id="r-kategorie" bind:value={r.kategorie}>
									<option value="">von Hand</option>
									{#each kategorien as k (k.id)}<option value={k.id}>Actual: {k.name}</option>{/each}
									<!-- Verknüpfte Kategorie, die (ohne Actual oder nach dem Löschen) nicht in der Liste steht. -->
									{#if r.kategorie && !kategorien.some((k) => k.id === r.kategorie)}
										<option value={r.kategorie}>Actual: nicht gefunden</option>
									{/if}
								</select>
							</div>
						{/if}
						{#if !r.kategorie}
							<div class="field">
								<label for="r-stand">Liegt schon da</label>
								<input id="r-stand" bind:value={r.stand} inputmode="decimal" placeholder="z. B. 0" />
							</div>
						{/if}
					{/if}
					<div class="field">
						<label class="check"><input type="checkbox" bind:checked={r.aktiv} /> Aktiv, geht jeden Monat raus</label>
					</div>
				</div>

				{#if bearbeitet.index != null}
					<button type="submit" class="danger" form="ruecklage-loeschen" disabled={laeuft}>Rücklage löschen</button>
				{/if}
			</div>
		</form>
		<form id="ruecklage-loeschen" method="POST" action="?/rueckstellungen" use:enhance={absenden} hidden>
			<input type="hidden" name="rueckstellungen" value={loeschText} />
		</form>
	{/if}
</Sheet>

<style>
	.leer { margin: 0; padding: 16px 20px; color: var(--secondary); }
	.unten { padding: 8px 20px 16px; }
	.zustand { text-transform: none; }
	.zustand.erreicht { color: var(--calm); font-weight: 600; }
	.zustand.pausiert, .zustand.faellig { color: var(--secondary); }
	.mit-einheit { display: flex; gap: 8px; align-items: center; }
	.mit-einheit input { flex: 1 1 auto; min-width: 0; }
	.mit-einheit select { flex: 0 0 auto; width: auto; }
	.stand { display: grid; gap: 6px; padding: 14px 20px; }
	.hinweis { color: var(--warm); font-size: 14px; font-weight: 600; }
	.balken { height: 8px; border-radius: 4px; background: var(--fill); overflow: hidden; }
	.balken span { display: block; height: 100%; background: var(--tint); border-radius: 4px; }
	.fehler { color: var(--warm); font-weight: 600; margin: 0 4px; }
</style>
