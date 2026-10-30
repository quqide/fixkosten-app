import { fail } from '@sveltejs/kit';
import { leseBetrag, leseGanzzahl, leseProzent } from '#lib/eingabe.ts';
import { auftraegeFuerModus } from '#lib/rechnung/aufstellung.ts';
import { leseAuftraege } from '#lib/server/formular.ts';
import { heute } from '#lib/rechnung/datum.ts';
import { rueckstellungenMitStand } from '#lib/server/ansicht.ts';
import { angemeldet, hinweisAktionen } from '#lib/server/aktionen.ts';
import { ActualFehler, actualEingerichtet, ladeKonten, type ActualKonto } from '#lib/server/actual.ts';
import {
	ausgeblendeteHinweise,
	holeAusActual,
	uebernehmeTerminplaene,
	warnungenFuer,
	zuordnungAnsicht,
	type Schnappschuss
} from '#lib/server/actualAbgleich.ts';
import type { PersonId } from '#lib/server/db.ts';
import {
	aenderePerson,
	aendereModus,
	importiere,
	ladeAuftraege,
	speichereAuftraege,
	ladeActualStand,
	ladePosten,
	setzeTerminplan,
	speichereZuordnung,
	type ZuordnungEintrag,
	ladePerson,
	ladePersonen,
	ladeRueckstellungen,
	letzteAenderungen,
	speichereRueckstellungen,
	type Hell,
	type RueckstellungEintrag,
	type Sicherung
} from '#lib/server/repo.ts';
import { THEMES } from '#lib/themes.ts';
import type { Actions, PageServerLoad } from './$types';

async function kontenOderFehler(id: PersonId): Promise<{ konten: ActualKonto[]; fehler?: string }> {
	try {
		return { konten: await ladeKonten(id) };
	} catch (e) {
		if (!(e instanceof ActualFehler)) console.error('Actual-Konten nicht geladen', e);
		return { konten: [], fehler: e instanceof ActualFehler ? e.message : 'Die Konten ließen sich nicht laden.' };
	}
}

export const load: PageServerLoad = ({ locals }) => {
	const id = angemeldet(locals);
	const actual = actualEingerichtet(id);
	return {
		actual,
		// Wird nachgeliefert, damit die Seite nicht auf Actual warten muss.
		actualKonten: actual ? kontenOderFehler(id) : null,
		zuordnung: actual ? zuordnungAnsicht(id) : null,
		warnungen: actual ? warnungenFuer(id) : [],
		ausgeblendet: ausgeblendeteHinweise(id),
		person: ladePerson(id),
		auftraege: ladeAuftraege(id),
		rueckstellungen: rueckstellungenMitStand(id, heute()),
		// Ausgabe-Kategorien aus dem letzten Abruf, für den Stand der Rückstellungen.
		ausgabeKategorien: actual ? (ladeActualStand<Schnappschuss>(id)?.daten.kategorien.filter((k) => !k.einnahme) ?? []) : [],
		verlauf: letzteAenderungen(15),
		namen: Object.fromEntries(ladePersonen().map((p) => [p.id, p.name]))
	};
};

export const actions: Actions = {
	...hinweisAktionen,

	modus: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const modus = Number((await request.formData()).get('modus'));
		if (modus !== 1 && modus !== 2) return fail(400, { bereich: 'modus', fehler: { modus: 'Bitte wähle ein Kontenmodell.' } });
		// Daueraufträge passend machen: Modus 2 braucht die Fixkosten-Rate, Modus 1 einen Rest fürs Spaßkonto.
		const auftraege = auftraegeFuerModus(ladeAuftraege(wer), modus);
		const undoId = aendereModus(wer, modus, auftraege, wer);
		return { meldung: 'Kontenmodell geändert, Daueraufträge angepasst.', undoId };
	},

	auftraege: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		let roh: unknown;
		try {
			roh = JSON.parse(String((await request.formData()).get('auftraege') ?? '[]'));
		} catch {
			return fail(400, { bereich: 'auftraege', fehler: { allgemein: 'Die Eingaben ließen sich nicht lesen.' } });
		}
		const ergebnis = leseAuftraege(roh, wknsVon(wer));
		if ('fehler' in ergebnis) return fail(400, { bereich: 'auftraege', fehler: ergebnis.fehler });
		const undoId = speichereAuftraege(wer, ergebnis.auftraege, wer);
		return { meldung: 'Daueraufträge gespeichert.', undoId };
	},

	profil: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const f = await request.formData();
		const name = String(f.get('name') ?? '').trim();
		const nettoCent = leseBetrag(String(f.get('netto') ?? ''));
		const ueberweisungstag = leseGanzzahl(String(f.get('tag') ?? ''));
		const pufferCent = leseBetrag(String(f.get('puffer') ?? '') || '0');
		const fehler: Record<string, string> = {};
		if (!name) fehler.name = 'Wie heißt du? Der Name erscheint oben in der Auswahl.';
		if (nettoCent == null || nettoCent < 0) fehler.netto = 'Bitte dein Nettogehalt in Euro eintragen, zum Beispiel 3450.';
		if (!ueberweisungstag || ueberweisungstag < 1 || ueberweisungstag > 28) fehler.tag = 'Bitte einen Tag zwischen 1 und 28 eintragen.';
		if (pufferCent == null || pufferCent < 0) fehler.puffer = 'Bitte einen Betrag in Euro eintragen, zum Beispiel 25.';
		if (Object.keys(fehler).length) return fail(400, { bereich: 'profil', fehler });
		const undoId = aenderePerson(
			wer,
			{ name, nettoCent: nettoCent!, ueberweisungstag: ueberweisungstag!, pufferCent: pufferCent! },
			wer,
			'Gehalt und Sparen geändert'
		);
		return { meldung: 'Gespeichert.', undoId };
	},

	rueckstellungen: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		let roh: unknown;
		try {
			roh = JSON.parse(String((await request.formData()).get('rueckstellungen') ?? '[]'));
		} catch {
			return fail(400, { bereich: 'rueckstellungen', fehler: { allgemein: 'Die Eingaben ließen sich nicht lesen.' } });
		}
		const ergebnis = leseRueckstellungen(roh, wer);
		if ('fehler' in ergebnis) return fail(400, { bereich: 'rueckstellungen', fehler: ergebnis.fehler });
		const undoId = speichereRueckstellungen(wer, ergebnis.liste, wer);
		return { meldung: 'Rückstellungen gespeichert.', undoId };
	},

	darstellung: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const f = await request.formData();
		const theme = String(f.get('theme') ?? '');
		const hell = String(f.get('hell') ?? '') as Hell;
		if (!THEMES[theme] || !['auto', 'light', 'dark'].includes(hell)) return fail(400, { bereich: 'darstellung', fehler: {} });
		aenderePerson(wer, { theme, hell }, wer, 'Darstellung geändert');
		return {};
	},

	actualKonto: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const wahl = String((await request.formData()).get('konto') ?? '');
		const [kontoId, ...name] = wahl.split('|');
		const undoId = aenderePerson(
			wer,
			kontoId
				? { actualKontoId: kontoId, actualKontoName: name.join('|'), istQuelle: 'hand', abgleich: null }
				: { actualKontoId: null, actualKontoName: null, istQuelle: 'hand', abgleich: null },
			wer,
			kontoId ? 'Konto in Actual gewählt' : 'Actual-Anbindung ausgeschaltet'
		);
		return { meldung: kontoId ? 'Konto gewählt. Der Kontostand kommt jetzt aus Actual.' : 'Kontostand wieder von Hand.', undoId };
	},

	actualAbruf: async ({ locals }) => {
		const wer = angemeldet(locals);
		try {
			const { geaendert } = await holeAusActual(wer);
			return { meldung: geaendert ? `Abgerufen, ${geaendert} Posten angepasst.` : 'Aus Actual abgerufen.' };
		} catch (e) {
			if (!(e instanceof ActualFehler)) console.error('Actual-Abruf fehlgeschlagen', e);
			return fail(502, {
				bereich: 'actual',
				fehler: { actual: e instanceof ActualFehler ? e.message : 'Der Abruf aus Actual hat nicht geklappt.' }
			});
		}
	},

	gehaltKategorie: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const kategorie = String((await request.formData()).get('kategorie') ?? '') || null;
		const undoId = aenderePerson(wer, { actualGehaltKategorie: kategorie }, wer, 'Gehaltskategorie gewählt');
		return { meldung: kategorie ? 'Gehalt wird jetzt an der Kategorie erkannt.' : 'Gehalt wird am Betrag erkannt.', undoId };
	},

	zuordnung: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const stand = ladeActualStand<Schnappschuss>(wer);
		if (!stand) return fail(400, { bereich: 'actual', fehler: { actual: 'Bitte zuerst aus Actual abrufen.' } });
		const f = await request.formData();
		const liste: ZuordnungEintrag[] = [];
		const verknuepfe = new Map<string, number | null>();
		for (const t of stand.daten.terminplaene) {
			const wert = String(f.get(`rolle_${t.id}`) ?? '');
			if (!wert) continue;
			if (wert === 'ignorieren') liste.push({ terminplan: t.id, rolle: 'ignorieren', dauerauftrag: null });
			else if (wert.startsWith('dauerauftrag:')) {
				liste.push({ terminplan: t.id, rolle: 'dauerauftrag', dauerauftrag: wert.slice('dauerauftrag:'.length) });
			} else if (wert.startsWith('fixkosten')) {
				liste.push({ terminplan: t.id, rolle: 'fixkosten', dauerauftrag: null });
				const postenId = Number(wert.split(':')[1]);
				if (postenId) verknuepfe.set(t.id, postenId);
			}
		}
		const fixkosten = new Set(liste.filter((z) => z.rolle === 'fixkosten').map((z) => z.terminplan));
		for (const p of ladePosten(wer)) {
			// Nicht mehr als Fixkosten zugeordnet: Posten bleibt, wird aber wieder von Hand gepflegt.
			if (p.actualTerminplan && !fixkosten.has(p.actualTerminplan)) setzeTerminplan(p.id!, null);
		}
		for (const [terminplan, postenId] of verknuepfe) {
			if (postenId && ladePosten(wer).some((p) => p.id === postenId)) setzeTerminplan(postenId, terminplan);
		}
		speichereZuordnung(wer, liste, wer);
		const geaendert = uebernehmeTerminplaene(wer, stand.daten.terminplaene);
		return {
			meldung: geaendert
				? `Zuordnung gespeichert, ${geaendert === 1 ? 'ein Posten' : `${geaendert} Posten`} aus Actual übernommen.`
				: 'Zuordnung gespeichert.'
		};
	},

	import: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const datei = (await request.formData()).get('datei');
		if (!(datei instanceof File) || datei.size === 0) {
			return fail(400, { bereich: 'import', fehler: { datei: 'Bitte wähle eine Sicherungsdatei aus.' } });
		}
		let umbenannt: string[];
		try {
			umbenannt = importiere(JSON.parse(await datei.text()) as Sicherung, wer).umbenannt;
		} catch (e) {
			const text = e instanceof SyntaxError ? 'Die Datei ist keine gültige Sicherung.' : (e as Error).message;
			return fail(400, { bereich: 'import', fehler: { datei: text } });
		}
		const hinweis = umbenannt.length ? ` Doppelte Namen umbenannt: ${umbenannt.join(', ')}.` : '';
		return { meldung: `Sicherung eingespielt.${hinweis}` };
	}
};

type Roh = Record<string, unknown>;

/** WKNs der Rückstellungen, damit „Rücklagen mit Ziel“ sie gleich schreibt. */
const wknsVon = (person: PersonId) => ladeRueckstellungen(person).flatMap((r) => (r.wkn ? [r.wkn] : []));

/** Prüft die Rückstellungen aus dem Formular. */
function leseRueckstellungen(roh: unknown, person: PersonId): { liste: RueckstellungEintrag[] } | { fehler: Record<string, string> } {
	const fehler: Record<string, string> = {};
	const liste: RueckstellungEintrag[] = [];
	if (!Array.isArray(roh)) return { fehler: { allgemein: 'Die Eingaben ließen sich nicht lesen.' } };
	const bisherige = new Map(ladeRueckstellungen(person).map((r) => [r.id, r]));
	roh.forEach((r: Roh, i) => {
		const name = String(r.name ?? '').trim();
		const art = (['fest', 'faellig', 'ziel'].includes(String(r.art)) ? r.art : 'fest') as RueckstellungEintrag['art'];
		const betragText = String(r.betrag ?? '').trim();
		if (!name && !betragText && !String(r.ziel ?? '').trim()) return;
		const f = (text: string) => void (fehler[`r_${i}`] = text);
		if (!name) return f('Wofür legst du das Geld zurück?');
		const betragCent = art === 'faellig' ? 0 : leseBetrag(betragText);
		if (betragCent == null || betragCent < 0) return f(`„${name}“: Bitte den Betrag pro Monat eintragen.`);

		let zielCent: number | null = null;
		let zielNettoFaktor: number | null = null;
		const zielText = String(r.ziel ?? '').trim();
		if (art === 'ziel' && r.zielArt === 'netto') {
			zielNettoFaktor = leseProzent(zielText);
			if (!zielNettoFaktor || zielNettoFaktor <= 0) return f(`„${name}“: Wie viele Nettogehälter sollen es sein, zum Beispiel 3?`);
		} else if (art !== 'fest') {
			zielCent = leseBetrag(zielText);
			if (!zielCent || zielCent <= 0) return f(`„${name}“: Bitte den Zielbetrag eintragen.`);
		}
		const faellig = art === 'faellig' ? String(r.faellig ?? '') : null;
		if (art === 'faellig' && !/^\d{4}-\d{2}-\d{2}$/.test(faellig ?? '')) return f(`„${name}“: Wann wird das Geld gebraucht?`);

		const wohin = String(r.wohin ?? '').trim();
		const istWkn = r.wohinArt === 'wkn';
		const actualKategorie = String(r.kategorie ?? '') || null;
		const standCent = actualKategorie ? null : leseBetrag(String(r.stand ?? ''));
		const vorher = typeof r.id === 'number' ? bisherige.get(r.id) : undefined;
		liste.push({
			person,
			name,
			art,
			betragCent,
			zielCent,
			zielNettoFaktor,
			faellig,
			zielkonto: istWkn ? null : wohin || null,
			wkn: istWkn ? wohin.toUpperCase() || null : null,
			aktiv: r.aktiv !== false,
			actualKategorie,
			standCent,
			// Datum nur neu setzen, wenn sich der Stand geändert hat.
			standDatum: standCent == null ? null : vorher?.standCent === standCent ? vorher.standDatum : heute()
		});
	});
	return Object.keys(fehler).length ? { fehler } : { liste };
}
