<script lang="ts">
	import { enhance } from '$app/forms';
	import { ABBUCHUNGSARTEN, ARTEN } from '#lib/rechnung/fixkosten.ts';
	import type { FixkostenPosten } from '#lib/rechnung/fixkosten.ts';
	import { betragFeld, datumLang, intervallText } from '#lib/format.ts';
	import { letzterKuendigungstag, type FristEinheit } from '#lib/rechnung/vertrag.ts';
	import { zeigeToast } from '#lib/toast.svelte.ts';
	import type { SubmitFunction } from '$app/forms';
	import { heute } from '#lib/rechnung/datum.ts';
	import Icon from './Icon.svelte';
	import PostenSymbol from './PostenSymbol.svelte';
	import { hinweisSchluessel, istAusblendbar, type Warnung } from '#lib/rechnung/terminplan.ts';
	import { POSTEN_ICONS, schlageIconVor, type PostenIcon } from '#lib/postenIcons.ts';

	type Posten = FixkostenPosten & { id?: number; actualTerminplan?: string | null; meldungen?: Warnung[] };

	let { posten = $bindable(), neuTitel = 'Neue Fixkosten' }: { posten: Posten | null | undefined; neuTitel?: string } = $props();

	let dialog: HTMLDialogElement;
	let fehler = $state<Record<string, string>>({});
	let beteiligungen = $state<{ name: string; betrag: string; tag: string }[]>([]);
	let name = $state('');
	// Vertragsangaben, gebunden für den Hinweis zum letzten Kündigungstag.
	let vEnde = $state('');
	let vFrist = $state('');
	let vEinheit = $state<FristEinheit>('monate');
	let vVerl = $state('');
	let vKunde = $state('');
	let vNotiz = $state('');
	// Nur beim Öffnen und bei Fehlern aufklappen, sonst entscheidet der Nutzer.
	let vertragOffen = $state(false);
	const kuendigung = $derived.by(() => {
		const anzahl = Number(vFrist);
		const verl = Number(vVerl);
		// Eine ungültige Frist würde wie „keine Frist“ rechnen und einen zu späten Tag zeigen.
		if (vFrist && !(Number.isInteger(anzahl) && anzahl >= 0)) return null;
		try {
			return letzterKuendigungstag(
				{
					laufzeitEnde: vEnde || null,
					kuendigungsfrist: vFrist && Number.isInteger(anzahl) && anzahl >= 0 ? { anzahl, einheit: vEinheit } : null,
					verlaengerungMonate: vVerl && Number.isInteger(verl) && verl > 0 ? verl : null,
					kundennummer: null,
					notiz: null
				},
				heute()
			);
		} catch {
			return null;
		}
	});
	let icon = $state('');
	const vorschlag = $derived(schlageIconVor(name));
	const iconListe = Object.entries(POSTEN_ICONS) as [PostenIcon, { name: string; svg: string }][];

	const neu = $derived(posten != null && posten.id == null);
	/** Name, Betrag, Rhythmus und Termin pflegt Actual. */
	const ausActual = $derived(!!posten?.actualTerminplan);

	$effect(() => {
		if (posten) {
			fehler = {};
			name = posten.name ?? '';
			icon = posten.icon ?? '';
			const v = posten.vertrag;
			vEnde = v?.laufzeitEnde ?? '';
			vFrist = v?.kuendigungsfrist ? String(v.kuendigungsfrist.anzahl) : '';
			vEinheit = v?.kuendigungsfrist?.einheit ?? 'monate';
			vVerl = v?.verlaengerungMonate ? String(v.verlaengerungMonate) : '';
			vKunde = v?.kundennummer ?? '';
			vNotiz = v?.notiz ?? '';
			// Aus v, nicht aus den Feldern: sonst hinge der Effekt an jeder Eingabe und setzte sie zurück.
			vertragOffen = !!(v?.laufzeitEnde || v?.kuendigungsfrist || v?.verlaengerungMonate || v?.kundennummer || v?.notiz);
			beteiligungen = (posten.beteiligungen ?? []).map((b) => ({
				name: b.name,
				betrag: betragFeld(b.betragCent),
				tag: b.eingangstag ? String(b.eingangstag) : ''
			}));
			if (!dialog.open) dialog.showModal();
		} else if (dialog?.open) {
			dialog.close();
		}
	});

	function schliessen() {
		posten = null;
	}

	const absenden: SubmitFunction = () => async ({ result, update }) => {
		if (result.type === 'failure') {
			fehler = (result.data?.fehler as Record<string, string>) ?? {};
			if (Object.keys(fehler).some((k) => k.startsWith('v_'))) vertragOffen = true;
			return;
		}
		if (result.type === 'error') {
			zeigeToast('Das hat nicht geklappt. Bitte versuch es noch einmal.');
			return;
		}
		await update({ reset: false });
		const daten = result.type === 'success' ? (result.data as { meldung?: string; undoId?: number }) : undefined;
		if (daten?.meldung) zeigeToast(daten.meldung, daten.undoId ?? null);
		schliessen();
	};
</script>

<dialog bind:this={dialog} onclose={schliessen} aria-labelledby="posten-titel">
	{#if posten}
		<form method="POST" action="?/speichern" use:enhance={absenden} novalidate>
			<div class="sheet-head">
				<h2 id="posten-titel">{neu ? neuTitel : posten.name}</h2>
				<button type="button" class="close" onclick={schliessen} aria-label="Schließen"><Icon name="schliessen" size={16} /></button>
			</div>
			<div class="sheet-body">
				{#if posten.id != null}<input type="hidden" name="id" value={posten.id} />{/if}
				{#if posten.meldungen?.length}
					<div class="card meldungen" role="group" aria-label="Meldungen aus Actual">
						<ul class="rows">
							{#each posten.meldungen as m, i (i)}
								<li><div class="row">
									<span class="stufe {m.stufe}" role="img" aria-label={m.stufe === 'warnung' ? 'Warnung' : 'Hinweis'}>{m.stufe === 'warnung' ? '!' : 'i'}</span>
									<span class="main"><span class="title">{m.text}</span><span class="detail">{m.tun}</span>
										{#if istAusblendbar(m)}
											<button type="submit" class="textlink ausblenden" form="posten-hinweis" name="hinweis" value={hinweisSchluessel(m.terminplanId!, m.art)}>Nicht mehr anzeigen</button>
										{/if}
									</span>
								</div></li>
							{/each}
						</ul>
					</div>
				{/if}
				{#if ausActual}<p class="note aus-actual">Name, Betrag, Rhythmus und Termin kommen aus dem Terminplan in Actual. Ändere sie dort, die App übernimmt sie beim nächsten Abruf.</p>{/if}
				{#if fehler.allgemein}<p class="note" role="alert" style="color:var(--warm)">{fehler.allgemein}</p>{/if}
				<div class="card">
					<div class="field">
						<label for="p-name">Wofür?</label>
						<input id="p-name" name="name" bind:value={name} readonly={ausActual} placeholder="z. B. Netflix" autocomplete="off"
							aria-invalid={!!fehler.name} aria-describedby={fehler.name ? 'p-name-f' : undefined} />
						{#if fehler.name}<span class="error" id="p-name-f">{fehler.name}</span>{/if}
					</div>
					<div class="field">
						<label for="p-betrag">Wie viel pro Abbuchung?</label>
						<input id="p-betrag" name="betrag" value={betragFeld(posten.betragCent || null)} readonly={ausActual} inputmode="decimal" placeholder="0,00"
							aria-invalid={!!fehler.betrag} aria-describedby={fehler.betrag ? 'p-betrag-f' : 'p-betrag-h'} />
						{#if fehler.betrag}<span class="error" id="p-betrag-f">{fehler.betrag}</span>{:else}<span class="help" id="p-betrag-h">In Euro, zum Beispiel 12,99</span>{/if}
					</div>
					<div class="field">
						<label for="p-intervall">Wie oft?</label>
						{#if ausActual}
							<input id="p-intervall" value={intervallText(posten.intervallMonate)} readonly />
							<input type="hidden" name="intervall" value={posten.intervallMonate} />
						{:else}
						<select id="p-intervall" name="intervall" value={String(posten.intervallMonate || 1)}>
							<option value="1">Jeden Monat</option>
							<option value="2">Alle zwei Monate</option>
							<option value="3">Alle drei Monate</option>
							<option value="6">Alle sechs Monate</option>
							<option value="12">Einmal im Jahr</option>
						</select>
						{/if}
					</div>
					<div class="field">
						<label for="p-datum">Wann wird abgebucht?</label>
						<input id="p-datum" name="buchungsdatum" type="date" value={posten.buchungsdatum ?? heute()} readonly={ausActual}
							aria-invalid={!!fehler.buchungsdatum} aria-describedby="p-datum-h" />
						{#if fehler.buchungsdatum}<span class="error">{fehler.buchungsdatum}</span>{/if}
						<span class="help" id="p-datum-h">Ein Datum genügt, egal ob vergangen oder künftig. Die übrigen Termine rechnet die App selbst aus.</span>
					</div>
				</div>

				<div class="card">
					<details class="field symbol-wahl">
						<summary>
							<PostenSymbol {name} icon={icon || null} klasse="a20" />
							<span class="label">Symbol</span>
							<span class="help">{icon ? POSTEN_ICONS[icon as PostenIcon]?.name : vorschlag ? `Automatisch: ${POSTEN_ICONS[vorschlag].name}` : 'Automatisch: Anfangsbuchstabe'}</span>
						</summary>
						<div class="symbole" role="radiogroup" aria-label="Symbol">
							<label title="Automatisch nach dem Namen">
								<input type="radio" name="icon" value="" bind:group={icon} />
								<span class="wahl auto">Auto</span>
							</label>
							{#each iconListe as [id, s] (id)}
								<label title={s.name}>
									<input type="radio" name="icon" value={id} bind:group={icon} />
									<span class="wahl">
										<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
											<!-- eslint-disable-next-line svelte/no-at-html-tags -- feste Pfade aus postenIcons.ts -->
											{@html s.svg}
										</svg>
									</span>
									<span class="visually-hidden">{s.name}</span>
								</label>
							{/each}
						</div>
					</details>
					<div class="field">
						<label for="p-art">Art</label>
						<select id="p-art" name="art" value={posten.art ?? '50 (Lebenshaltung)'}>
							{#each ARTEN as a (a)}<option value={a}>{a.replace(/^\d+ \((.*)\)$/, '$1')}</option>{/each}
						</select>
					</div>
					<div class="field">
						<label for="p-ab">Wie wird bezahlt?</label>
						<select id="p-ab" name="abbuchungsart" value={posten.abbuchungsart ?? ''}>
							<option value="">Keine Angabe</option>
							{#each ABBUCHUNGSARTEN as a (a)}<option value={a}>{a}</option>{/each}
						</select>
					</div>
				</div>

				<div class="card">
					<div class="field">
						<span class="label">Zahlt jemand einen Teil davon?</span>
						{#if beteiligungen.length === 0}
							<span class="help">Zum Beispiel, wenn du ein Familien-Abo teilst und andere dir ihren Anteil überweisen.</span>
						{/if}
						{#each beteiligungen as b, i (i)}
							<fieldset class="bet">
								<legend class="visually-hidden">Anteil {i + 1}</legend>
								<input name="bet_name" bind:value={b.name} placeholder="Wer?" aria-label="Name" />
								<div class="inline-fields">
									<input name="bet_betrag" bind:value={b.betrag} inputmode="decimal" placeholder="Betrag" aria-label="Betrag pro Abbuchung" />
									<input name="bet_tag" bind:value={b.tag} inputmode="numeric" placeholder="Eingang am (Tag)" aria-label="Tag im Monat, an dem das Geld eingeht" />
								</div>
								{#if fehler[`bet_${i}`]}<span class="error">{fehler[`bet_${i}`]}</span>{/if}
								<button type="button" class="textlink" onclick={() => beteiligungen.splice(i, 1)}>Entfernen</button>
							</fieldset>
						{/each}
						<button type="button" class="secondary" onclick={() => beteiligungen.push({ name: '', betrag: '', tag: '' })}>
							<Icon name="plus" size={18} />Person hinzufügen
						</button>
						{#if beteiligungen.length}<span class="help">Den Tag nur eintragen, wenn das Geld nicht zusammen mit der Abbuchung kommt.</span>{/if}
					</div>
				</div>

				<div class="card">
					<details class="field vertrag" bind:open={vertragOffen}>
						<summary>
							<span class="label">Vertrag</span>
							<span class="help">{kuendigung ? (kuendigung.status === 'abgelaufen' ? 'Laufzeit ist vorbei' : `Kündigen bis ${datumLang(kuendigung.letzterKuendigungstag)}`) : 'Laufzeit, Kündigungsfrist, Kundennummer'}</span>
						</summary>
						<span class="help">Nur in der App gespeichert{ausActual ? ', Actual kennt diese Angaben nicht' : ''}. Alles ist freiwillig.</span>
						<div class="inline-fields">
							<label class="mini"><span>Läuft bis</span>
								<input type="date" name="v_ende" bind:value={vEnde} aria-invalid={!!fehler.v_ende} />
							</label>
							<label class="mini"><span>Verlängert sich um</span>
								<span class="mit-einheit"><input name="v_verlaengerung" bind:value={vVerl} inputmode="numeric" placeholder="z. B. 12" aria-label="Automatische Verlängerung in Monaten" aria-invalid={!!fehler.v_verlaengerung} /><span>Monate</span></span>
							</label>
						</div>
						{#if fehler.v_ende}<span class="error">{fehler.v_ende}</span>{/if}
						{#if fehler.v_verlaengerung}<span class="error">{fehler.v_verlaengerung}</span>{/if}
						<label class="mini"><span>Kündigungsfrist</span>
							<span class="mit-einheit">
								<input name="v_frist" bind:value={vFrist} inputmode="numeric" placeholder="z. B. 3" aria-label="Kündigungsfrist" aria-invalid={!!fehler.v_frist} />
								<select name="v_einheit" bind:value={vEinheit} aria-label="Einheit der Kündigungsfrist">
									<option value="tage">Tage</option>
									<option value="wochen">Wochen</option>
									<option value="monate">Monate</option>
								</select>
							</span>
						</label>
						{#if fehler.v_frist}<span class="error">{fehler.v_frist}</span>{/if}
						{#if kuendigung}
							<span class="help">
								{kuendigung.status === 'abgelaufen'
									? `Die Laufzeit endete am ${datumLang(kuendigung.laufzeitEnde)} und verlängert sich nicht.`
									: `Läuft bis ${datumLang(kuendigung.laufzeitEnde)}. Kündigen spätestens am ${datumLang(kuendigung.letzterKuendigungstag)}.`}
							</span>
						{/if}
						<label class="mini"><span>Kundennummer</span>
							<input name="v_kundennummer" bind:value={vKunde} maxlength="200" autocomplete="off" aria-invalid={!!fehler.v_kundennummer} />
						</label>
						{#if fehler.v_kundennummer}<span class="error">{fehler.v_kundennummer}</span>{/if}
						<label class="mini"><span>Notiz</span>
							<textarea name="v_notiz" bind:value={vNotiz} maxlength="200" rows="2" aria-invalid={!!fehler.v_notiz}></textarea>
						</label>
						{#if fehler.v_notiz}<span class="error">{fehler.v_notiz}</span>{/if}
					</details>
				</div>

				<div class="sheet-actions">
					<button type="button" class="secondary" onclick={schliessen}>Abbrechen</button>
					<button type="submit" class="primary">{neu ? 'Hinzufügen' : 'Änderungen sichern'}</button>
				</div>
				{#if !neu}
					<button type="submit" class="danger" formaction="?/loeschen">„{posten.name}“ löschen</button>
				{/if}
			</div>
		</form>
		<!-- Eigenes Formular, damit Enter im Posten nicht den Hinweis ausblendet. -->
		<form id="posten-hinweis" method="POST" action="?/ausblenden" use:enhance={absenden} hidden></form>
	{/if}
</dialog>

<style>
	.aus-actual { margin: 0 4px 12px; }
	.meldungen { margin-bottom: 12px; }
	.vertrag { display: grid; gap: 10px; }
	.vertrag summary { cursor: pointer; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-height: 32px; }
	.vertrag .mini { display: grid; gap: 4px; }
	.vertrag .mini > span:first-child { font-size: 13px; color: var(--secondary); font-weight: 600; }
	.vertrag .mit-einheit { display: flex; gap: 6px; align-items: center; }
	.vertrag .mit-einheit input { flex: 0 0 6em; min-width: 0; width: 6em; }
	.vertrag .mit-einheit select { flex: 1; width: auto; min-width: 0; }
	.vertrag textarea { font: inherit; resize: vertical; }
	.stufe { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; flex: none; }
	.stufe.warnung { background: var(--warm-soft); color: var(--warm); }
	.stufe.hinweis { background: var(--calm-soft); color: var(--calm); }
	.meldungen .title { font-weight: 600; }
	input[readonly] { color: var(--secondary) !important; }
	.bet { border: 0; margin: 0; padding: 12px 0; display: grid; gap: 8px; border-bottom: 1px solid var(--separator); }
	.bet input { font-size: 16px; }
	.textlink { justify-self: start; color: var(--warm); }
	.textlink.ausblenden { color: var(--tint); }
	.symbol-wahl summary { display: flex; align-items: center; gap: 12px; cursor: pointer; list-style: none; }
	.symbol-wahl summary::-webkit-details-marker { display: none; }
	.symbol-wahl summary .help { margin-left: auto; text-align: right; }
	.symbole { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 6px; margin-top: 12px; }
	.symbole label { position: relative; }
	.symbole input { position: absolute; opacity: 0; inset: 0; margin: 0; }
	.wahl { display: grid; place-items: center; height: 44px; border-radius: 12px; background: var(--fill); color: var(--secondary); }
	.wahl.auto { font-size: 12px; font-weight: 600; }
	.symbole input:checked + .wahl { background: var(--tint-soft); color: var(--tint); box-shadow: inset 0 0 0 2px var(--tint); }
	.symbole input:focus-visible + .wahl { outline: 2px solid var(--tint); outline-offset: 2px; }
</style>
