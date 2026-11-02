import { fail } from '@sveltejs/kit';
import { leseBetrag, leseProzent } from '#lib/eingabe.ts';
import { auftraegeFuerModus, type AufstellungEingaben } from '#lib/rechnung/aufstellung.ts';
import { heute } from '#lib/rechnung/datum.ts';
import { zielVon } from '#lib/rechnung/rueckstellung.ts';
import { angemeldet } from '#lib/server/aktionen.ts';
import { actualEingerichtet } from '#lib/server/actual.ts';
import type { Schnappschuss } from '#lib/server/actualAbgleich.ts';
import { personAnsicht, rueckstellungenMitStand } from '#lib/server/ansicht.ts';
import type { PersonId } from '#lib/server/db.ts';
import { leseAuftraege } from '#lib/server/formular.ts';
import {
	aendereModus,
	ladeActualStand,
	ladeAuftraege,
	ladePerson,
	ladeRueckstellungen,
	speichereAuftraege,
	speichereRueckstellungen,
	type RueckstellungEintrag
} from '#lib/server/repo.ts';
import type { Actions, PageServerLoad } from './$types';

/** Was die Vorschau „Diesen Monat“ der Daueraufträge außer den Aufträgen selbst braucht. */
function planBasis(id: PersonId): Omit<AufstellungEingaben, 'auftraege'> {
	const a = personAnsicht(id, heute());
	return {
		modus: a.person.modus,
		nettoCent: a.person.nettoCent,
		rueckstellungen: a.rueckstellungen.map((r) => ({ name: r.eintrag.name, betragCent: r.rateCent, zielkonto: zielVon(r.eintrag) })),
		gemeinschaftCent: a.gemeinschaft.anteil[id].betragCent,
		fixkostenMonatlichCent: a.fixkosten.summeMonatlichCent
	};
}

export const load: PageServerLoad = ({ locals }) => {
	const id = angemeldet(locals);
	const person = ladePerson(id);
	return {
		modus: person.modus,
		ueberweisungstag: person.ueberweisungstag,
		auftraege: ladeAuftraege(id),
		planBasis: planBasis(id),
		rueckstellungen: rueckstellungenMitStand(id, heute()),
		// Ausgabe-Kategorien aus dem letzten Abruf, für den Stand der Rücklagen.
		ausgabeKategorien: actualEingerichtet(id) ? (ladeActualStand<Schnappschuss>(id)?.daten.kategorien.filter((k) => !k.einnahme) ?? []) : []
	};
};

export const actions: Actions = {
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
		return { meldung: 'Rücklagen gespeichert.', undoId };
	},

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
		// Fehler je Rücklage unter r_<index>, das betroffene Feld unter feld_<index> fürs Bearbeitungsfenster.
		const f = (text: string, feld: 'name' | 'betrag' | 'ziel' | 'faellig') => {
			fehler[`r_${i}`] = text;
			fehler[`feld_${i}`] = feld;
		};
		if (!name) return f('Wofür legst du das Geld zurück?', 'name');
		const betragCent = art === 'faellig' ? 0 : leseBetrag(betragText);
		if (betragCent == null || betragCent < 0) return f(`„${name}“: Bitte den Betrag pro Monat eintragen.`, 'betrag');

		let zielCent: number | null = null;
		let zielNettoFaktor: number | null = null;
		const zielText = String(r.ziel ?? '').trim();
		if (art === 'ziel' && r.zielArt === 'netto') {
			zielNettoFaktor = leseProzent(zielText);
			if (!zielNettoFaktor || zielNettoFaktor <= 0) return f(`„${name}“: Wie viele Nettogehälter sollen es sein, zum Beispiel 3?`, 'ziel');
		} else if (art !== 'fest') {
			zielCent = leseBetrag(zielText);
			if (!zielCent || zielCent <= 0) return f(`„${name}“: Bitte den Zielbetrag eintragen.`, 'ziel');
		}
		const faellig = art === 'faellig' ? String(r.faellig ?? '') : null;
		if (art === 'faellig' && !/^\d{4}-\d{2}-\d{2}$/.test(faellig ?? '')) return f(`„${name}“: Wann wird das Geld gebraucht?`, 'faellig');

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
