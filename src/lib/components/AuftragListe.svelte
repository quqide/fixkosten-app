<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { ausEntwurf, klartext, neuerEntwurf, TEILE, zuEntwurf, type AuftragEntwurf } from '#lib/auftragEntwurf.ts';
	import { eur } from '#lib/format.ts';
	import { berechneAufstellung, type AufstellungEingaben, type AuftragKonfig } from '#lib/rechnung/aufstellung.ts';
	import { SCHRITTE } from '#lib/rechnung/rundung.ts';
	import { zeigeToast } from '#lib/toast.svelte.ts';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	let {
		auftraege,
		basis,
		ziele = []
	}: {
		/** Gespeicherte Daueraufträge in ihrer Reihenfolge. */
		auftraege: AuftragKonfig[];
		/** Alles außer den Aufträgen, was die Rechnung „Diesen Monat“ braucht. */
		basis: Omit<AufstellungEingaben, 'auftraege'>;
		/** Vorschläge fürs Zielkonto und das Ziel der Rücklagen. */
		ziele?: string[];
	} = $props();

	const betraegeVon = (liste: AuftragKonfig[]) => berechneAufstellung({ ...basis, auftraege: liste }).dauerauftraege.map((d) => d.betragCent);
	const betraege = $derived(betraegeVon(auftraege));

	/** Was gerade im Fenster bearbeitet wird; `index` null heißt neu. */
	let bearbeitet = $state<{ index: number | null; position: number; entwurf: AuftragEntwurf } | null>(null);
	let fehler = $state<Record<string, string>>({});
	let laeuft = $state(false);

	function oeffnen(index: number | null) {
		fehler = {};
		bearbeitet = index == null
			? { index: null, position: auftraege.length, entwurf: neuerEntwurf() }
			: { index, position: index, entwurf: zuEntwurf(auftraege[index]) };
	}
	const schliessen = () => (bearbeitet = null);

	/** Die ganze Liste, wie sie mit der Änderung aussähe, in Entwurfsform für die Action. */
	function listeMit(b: NonNullable<typeof bearbeitet>): AuftragEntwurf[] {
		const andere = auftraege.map(zuEntwurf).filter((_, i) => i !== b.index);
		andere.splice(b.position, 0, b.entwurf);
		return andere;
	}
	const anzahl = $derived(bearbeitet ? auftraege.length + (bearbeitet.index == null ? 1 : 0) : 0);
	const vorschau = $derived.by(() => {
		if (!bearbeitet) return null;
		const liste = listeMit(bearbeitet).map(ausEntwurf);
		return betraegeVon(liste)[bearbeitet.position] ?? 0;
	});
	const speicherText = $derived(bearbeitet ? JSON.stringify(listeMit(bearbeitet)) : '[]');
	const loeschText = $derived(
		bearbeitet && bearbeitet.index != null ? JSON.stringify(auftraege.map(zuEntwurf).filter((_, i) => i !== bearbeitet!.index)) : '[]'
	);

	/** Fehler am Feld des bearbeiteten Auftrags; Fehler, die zu keinem Feld passen, oben im Fenster. */
	const feldFehler = (feld: string) => (bearbeitet && fehler[`feld_${bearbeitet.position}`] === feld ? fehler[`a_${bearbeitet.position}`] : undefined);
	const obenFehler = $derived.by(() => {
		if (!bearbeitet) return undefined;
		if (fehler[`a_${bearbeitet.position}`] && fehler[`feld_${bearbeitet.position}`]) return undefined;
		return fehler[`a_${bearbeitet.position}`] ?? fehler.allgemein;
	});

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

	function verschiebe(um: number) {
		if (!bearbeitet) return;
		bearbeitet.position = Math.min(anzahl - 1, Math.max(0, bearbeitet.position + um));
		fehler = {};
	}
</script>

{#if auftraege.length}
	<ul class="rows">
		{#each auftraege as a, i (i)}
			<li>
				<button type="button" class="row" onclick={() => oeffnen(i)}>
					<span class="main"><span class="title">{a.name}</span><span class="detail">{klartext(a)}</span></span>
					<span class="value">{eur(betraege[i] ?? 0)}</span>
					<span class="chev"><Icon name="pfeil" size={14} /></span>
				</button>
			</li>
		{/each}
	</ul>
{:else}
	<p class="leer">Noch keine Daueraufträge. Leg den ersten an, zum Beispiel für den ETF-Sparplan.</p>
{/if}
<div class="unten">
	<button type="button" class="secondary" onclick={() => oeffnen(null)}><Icon name="plus" size={18} />Dauerauftrag hinzufügen</button>
</div>

<Sheet offen={bearbeitet != null} titel={bearbeitet?.index == null ? 'Neuer Dauerauftrag' : 'Dauerauftrag'} formular="auftrag-formular" onabbrechen={schliessen}>
	{#if bearbeitet}
		{@const e = bearbeitet.entwurf}
		<form id="auftrag-formular" method="POST" action="?/auftraege" use:enhance={absenden} novalidate>
			<input type="hidden" name="auftraege" value={speicherText} />
			<div class="sheet-body">
				{#if obenFehler}<p class="note fehler" role="alert">{obenFehler}</p>{/if}
				<div class="card">
					<div class="field">
						<label for="a-name">Name</label>
						<input id="a-name" bind:value={e.name} placeholder="z. B. ETF-Sparplan" autocomplete="off" maxlength="100"
							aria-invalid={!!feldFehler('name')} aria-describedby={feldFehler('name') ? 'a-name-f' : undefined} />
						{#if feldFehler('name')}<span class="error" id="a-name-f">{feldFehler('name')}</span>{/if}
					</div>
					<div class="field">
						<label for="a-ziel">Geht auf</label>
						<input id="a-ziel" bind:value={e.zielkonto} placeholder="z. B. Depot" list="ziele" autocomplete="off" maxlength="100"
							aria-invalid={!!feldFehler('ziel')} aria-describedby={feldFehler('ziel') ? 'a-ziel-f' : undefined} />
						{#if feldFehler('ziel')}<span class="error" id="a-ziel-f">{feldFehler('ziel')}</span>{/if}
					</div>
				</div>

				<div class="card">
					<fieldset class="field teile" aria-describedby={feldFehler('teile') ? 'a-teile-f' : undefined}>
						<legend class="label">Setzt sich zusammen aus</legend>
						{#each e.bausteine as b, j (j)}
							<div class="teil">
								<select bind:value={b.typ} aria-label="Teil {j + 1}">
									{#each TEILE as t (t.typ)}<option value={t.typ}>{t.name}</option>{/each}
								</select>
								{#if b.typ === 'fest'}<input bind:value={b.wert} inputmode="decimal" placeholder="Betrag in €" aria-label="Betrag in Euro" />
								{:else if b.typ === 'prozent'}<input bind:value={b.wert} inputmode="decimal" placeholder="Prozent" aria-label="Prozent vom Netto" />
								{:else if b.typ === 'ruecklagen'}<input bind:value={b.wert} placeholder="Ziel, z. B. Tagesgeld" aria-label="Ziel der Rücklagen" list="ziele" />{/if}
								{#if e.bausteine.length > 1}
									<button type="button" class="textlink entfernen" onclick={() => e.bausteine.splice(j, 1)}>Entfernen<span class="visually-hidden"> Teil {j + 1}</span></button>
								{/if}
							</div>
						{/each}
						{#if feldFehler('teile')}<span class="error" id="a-teile-f">{feldFehler('teile')}</span>{/if}
						<button type="button" class="textlink plus" onclick={() => e.bausteine.push({ typ: 'fest', wert: '' })}>+ Weiteren Teil hinzufügen</button>
					</fieldset>
					<div class="field">
						<span class="label" id="a-rundung-l">Runden</span>
						<div class="satz" role="group" aria-labelledby="a-rundung-l">
							{#if e.rundung.schritt > 1}
								<select bind:value={e.rundung.richtung} aria-label="Wie runden">
									<option value="kaufm">kaufmännisch</option><option value="auf">aufrunden</option><option value="ab">abrunden</option>
								</select>
								<span>auf</span>
							{/if}
							<select bind:value={e.rundung.schritt} aria-label="Auf welchen Betrag">
								{#each SCHRITTE as s (s)}<option value={s}>{s === 1 ? 'centgenau' : `${(s / 100).toLocaleString('de-DE')} €`}</option>{/each}
							</select>
						</div>
						{#if feldFehler('rundung')}<span class="error">{feldFehler('rundung')}</span>{/if}
					</div>
				</div>

				<div class="card vorschau" aria-live="polite">
					<span>Diesen Monat</span><strong>{eur(vorschau ?? 0)}</strong>
				</div>

				{#if anzahl > 1}
					<div class="card">
						<div class="field reihenfolge">
							<span class="label">Reihenfolge</span>
							<span class="help">Platz {bearbeitet.position + 1} von {anzahl}</span>
							<div class="pfeile">
								<button type="button" class="secondary" onclick={() => verschiebe(-1)} disabled={bearbeitet.position === 0}>↑ Nach oben</button>
								<button type="button" class="secondary" onclick={() => verschiebe(1)} disabled={bearbeitet.position >= anzahl - 1}>↓ Nach unten</button>
							</div>
						</div>
					</div>
				{/if}

				{#if bearbeitet.index != null}
					<button type="submit" class="danger" form="auftrag-loeschen" disabled={laeuft}>Dauerauftrag löschen</button>
				{/if}
			</div>
		</form>
		<form id="auftrag-loeschen" method="POST" action="?/auftraege" use:enhance={absenden} hidden>
			<input type="hidden" name="auftraege" value={loeschText} />
		</form>
	{/if}
</Sheet>

<style>
	.leer { margin: 0; padding: 16px 20px; color: var(--secondary); }
	.unten { padding: 8px 20px 16px; }
	.teile { border: 0; margin: 0; min-width: 0; display: grid; gap: 10px; }
	.teile legend { padding: 0; margin-bottom: 6px; }
	.teil { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
	.teil select, .teil input { min-width: 0; font-size: 16px; min-height: 44px; }
	/* Die Auswahl bekommt eine eigene Zeile, damit „Anteil Gemeinschaftskonto“ nicht abgeschnitten wird. */
	.teil select { flex: 1 1 100%; }
	.teil input { flex: 1 1 140px; }
	.teil + .teil { padding-top: 10px; border-top: 1px solid var(--separator); }
	.textlink { border: 0; background: none; padding: 0 4px; min-height: 44px; cursor: pointer; font-weight: 600; color: var(--tint); justify-self: start; }
	.textlink.entfernen { color: var(--warm); }
	.satz { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
	.satz select { flex: 1 1 auto; width: auto; min-width: 0; min-height: 44px; font-size: 16px; }
	.vorschau { display: flex; justify-content: space-between; align-items: baseline; padding: 14px 20px; background: var(--tint-soft); }
	.vorschau strong { font-size: 18px; font-variant-numeric: tabular-nums; }
	.reihenfolge { display: grid; gap: 6px; }
	.pfeile { display: flex; flex-wrap: wrap; gap: 8px; }
	.pfeile button { flex: 1 1 140px; }
	.fehler { color: var(--warm); font-weight: 600; margin: 0 4px; }
</style>
