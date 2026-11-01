/**
 * Was-wäre-wenn-Rechner: Änderungen aus den URL-Parametern lesen und auf die Eingaben der
 * Personenansicht anwenden. Nichts davon wird gespeichert.
 */
import { leseBetrag, leseGanzzahl } from '#lib/eingabe.ts';
import type { berechnePersonAnsicht, KontoDaten, PersonAnsichtEingaben, PersonDaten } from './ansicht';
import type { AuftragKonfig } from './aufstellung';
import type { FixkostenPosten } from './fixkosten';
import type { Person, Position } from './gemeinschaft';
import type { RueckstellungKonfig } from './rueckstellung';

export interface NeuerPosten {
	name: string;
	betragCent: number;
	intervallMonate: number;
	gemeinsam: boolean;
}

/** Abweichungen von heute. Was fehlt, bleibt wie gespeichert. */
export interface Aenderung {
	nettoCent?: number;
	nettoAndereCent?: number;
	/** Betrag je Gemeinschaftsposition „fester Betrag“, nach Positions-ID. */
	positionen: Map<number, number>;
	/** IDs von Posten (eigene oder gemeinsame), die testweise wegfallen. */
	ohne: Set<number>;
	neu: NeuerPosten[];
}

/** Eine eingetippte Zeile für einen zusätzlichen Posten, so wie sie im Formular wieder erscheint. */
export interface NeueZeile {
	name: string;
	betrag: string;
	intervall: string;
	wer: 'persoenlich' | 'gemeinsam';
}

export const MAX_RECHNER_CENT = 100_000_000;
const MAX_INTERVALL = 24;

/**
 * Liest die Änderungen aus den URL-Parametern. Ungültiges wird nicht übernommen, sondern als
 * freundliche Meldung je Feld zurückgegeben; gerechnet wird dann mit dem heutigen Wert.
 */
export function leseAenderung(params: URLSearchParams): { aenderung: Aenderung; zeilen: NeueZeile[]; fehler: Record<string, string> } {
	const fehler: Record<string, string> = {};
	const aenderung: Aenderung = { positionen: new Map(), ohne: new Set(), neu: [] };

	const betrag = (feld: string, text: string | null, wofuer: string) => {
		if (text == null || text.trim() === '') return undefined;
		const cent = leseBetrag(text);
		if (cent == null) fehler[feld] = `${wofuer}: Bitte eine Zahl eintragen, zum Beispiel 3.450 oder 3450,50.`;
		else if (cent < 0) fehler[feld] = `${wofuer}: Der Betrag darf nicht negativ sein.`;
		else if (cent > MAX_RECHNER_CENT) fehler[feld] = `${wofuer}: Das ist mehr, als die App rechnen kann.`;
		else return cent;
		return undefined;
	};

	aenderung.nettoCent = betrag('netto', params.get('netto'), 'Dein Netto');
	aenderung.nettoAndereCent = betrag('netto2', params.get('netto2'), 'Netto der anderen Person');

	for (const [schluessel, wert] of params) {
		const m = /^pos_(\d+)$/.exec(schluessel);
		if (!m) continue;
		const cent = betrag(schluessel, wert, 'Gemeinschaftsposition');
		if (cent != null) aenderung.positionen.set(Number(m[1]), cent);
	}

	for (const wert of params.getAll('ohne')) {
		const id = Number(wert);
		if (Number.isInteger(id) && id > 0) aenderung.ohne.add(id);
	}

	const namen = params.getAll('n_name');
	const betraege = params.getAll('n_betrag');
	const intervalle = params.getAll('n_intervall');
	const wer = params.getAll('n_wer');
	const zeilen: NeueZeile[] = [];
	const anzahl = Math.max(namen.length, betraege.length, intervalle.length);
	for (let i = 0; i < anzahl; i++) {
		const zeile: NeueZeile = {
			name: (namen[i] ?? '').trim().slice(0, 100),
			betrag: (betraege[i] ?? '').trim(),
			intervall: (intervalle[i] ?? '').trim(),
			wer: wer[i] === 'gemeinsam' ? 'gemeinsam' : 'persoenlich'
		};
		// Leere Zeilen (z. B. die freie Zeile am Ende) zählen nicht.
		if (!zeile.name && !zeile.betrag) continue;
		zeilen.push(zeile);
		const feld = `n_${zeilen.length - 1}`;
		const name = zeile.name || `Zusätzlicher Posten ${zeilen.length}`;
		const cent = leseBetrag(zeile.betrag);
		const monate = zeile.intervall === '' ? 1 : leseGanzzahl(zeile.intervall);
		if (cent == null || cent <= 0) fehler[feld] = `„${name}“: Bitte einen Betrag über 0 eintragen.`;
		else if (cent > MAX_RECHNER_CENT) fehler[feld] = `„${name}“: Das ist mehr, als die App rechnen kann.`;
		else if (monate == null || monate < 1 || monate > MAX_INTERVALL)
			fehler[feld] = `„${name}“: Das Intervall muss eine ganze Zahl von 1 bis ${MAX_INTERVALL} Monaten sein.`;
		else aenderung.neu.push({ name, betragCent: cent, intervallMonate: monate, gemeinsam: zeile.wer === 'gemeinsam' });
	}
	return { aenderung, zeilen, fehler };
}

/** Ob überhaupt etwas von heute abweicht. */
export function istLeer(a: Aenderung) {
	return a.nettoCent == null && a.nettoAndereCent == null && !a.positionen.size && !a.ohne.size && !a.neu.length;
}

interface KontoMitIds extends KontoDaten {
	positionen: (Position & { id?: number })[];
}

/** Die Eingaben der Personenansicht mit der Änderung. Die ursprünglichen Eingaben bleiben unverändert. */
export function mitAenderung<
	P extends PersonDaten,
	F extends FixkostenPosten & { id?: number },
	R extends RueckstellungKonfig,
	K extends KontoMitIds,
	A extends AuftragKonfig
>(e: PersonAnsichtEingaben<P, F, R, K, A>, a: Aenderung): PersonAnsichtEingaben<P, FixkostenPosten, R, KontoDaten, A> {
	const ich = e.id === 'a' ? 0 : 1;
	const nettoIch = a.nettoCent ?? e.person.nettoCent;
	const netto = (p: Person, i: number) => ({ ...p, nettoCent: i === ich ? nettoIch : (a.nettoAndereCent ?? p.nettoCent) });
	const [pa, pb] = e.gemeinschaft.personen;
	const personen: [Person, Person] = [netto(pa, 0), netto(pb, 1)];
	const neu = (gemeinsam: boolean): FixkostenPosten[] =>
		a.neu
			.filter((n) => n.gemeinsam === gemeinsam)
			.map((n) => ({ name: n.name, betragCent: n.betragCent, intervallMonate: n.intervallMonate, buchungsdatum: null }));
	const bleibt = (p: { id?: number }) => p.id == null || !a.ohne.has(p.id);
	return {
		...e,
		person: { ...e.person, nettoCent: nettoIch },
		posten: [...e.posten.filter(bleibt), ...neu(false)],
		gemeinschaft: {
			konto: {
				...e.gemeinschaft.konto,
				positionen: e.gemeinschaft.konto.positionen.map((p) =>
					p.art === 'fest' && p.id != null && a.positionen.has(p.id) ? { ...p, betragCent: a.positionen.get(p.id)! } : p
				)
			},
			posten: [...e.gemeinschaft.posten.filter(bleibt), ...neu(true)],
			personen
		}
	};
}

// ---------- Vergleich ----------

type Ansicht = Pick<ReturnType<typeof berechnePersonAnsicht>, 'fixkosten' | 'gemeinschaft' | 'aufstellung' | 'rueckstellungen' | 'auftraege'>;

export interface VergleichZeile {
	name: string;
	/** null: gibt es auf dieser Seite nicht. */
	heuteCent: number | null;
	mitCent: number | null;
	differenzCent: number;
}

export interface VergleichGruppe {
	titel: string;
	zeilen: VergleichZeile[];
}

const zeile = (name: string, heuteCent: number | null, mitCent: number | null): VergleichZeile => ({
	name,
	heuteCent,
	mitCent,
	differenzCent: (mitCent ?? 0) - (heuteCent ?? 0)
});

/** Paare nach Name; was nur auf einer Seite vorkommt, steht mit null auf der anderen. */
function nachName(heute: { name: string; betragCent: number }[], mit: { name: string; betragCent: number }[]) {
	const namen = [...new Set([...heute.map((x) => x.name), ...mit.map((x) => x.name)])];
	return namen.map((n) =>
		zeile(n, heute.find((x) => x.name === n)?.betragCent ?? null, mit.find((x) => x.name === n)?.betragCent ?? null)
	);
}

/** „Heute“ und „mit Änderung“ nebeneinander, mit Differenz. */
export function vergleicheAnsichten(
	heute: Ansicht,
	mit: Ansicht,
	id: 'a' | 'b',
	namen: { ich: string; andere: string }
): VergleichGruppe[] {
	const andere = id === 'a' ? 'b' : 'a';
	const hatRest = (x: Ansicht) => x.auftraege.some((a) => a.bausteine.some((b) => b.typ === 'rest'));
	const auftraege = nachName(heute.aufstellung.dauerauftraege, mit.aufstellung.dauerauftraege);
	if (!hatRest(heute)) auftraege.push(zeile('Frei verfügbar', heute.aufstellung.spassCent, mit.aufstellung.spassCent));
	return [
		{
			titel: 'Pro Monat',
			zeilen: [
				zeile('Deine Fixkosten', heute.fixkosten.summeMonatlichCent, mit.fixkosten.summeMonatlichCent),
				zeile('Gemeinsame Fixkosten', heute.gemeinschaft.rechnung.fixkostenCent, mit.gemeinschaft.rechnung.fixkostenCent),
				zeile(
					'Bleibt auf dem Gehaltskonto',
					heute.aufstellung.verbleibtAufGehaltskontoCent,
					mit.aufstellung.verbleibtAufGehaltskontoCent
				)
			]
		},
		{
			titel: 'Gemeinschaftskonto',
			zeilen: [
				zeile(`Anteil ${namen.ich}`, heute.gemeinschaft.anteil[id].betragCent, mit.gemeinschaft.anteil[id].betragCent),
				zeile(`Anteil ${namen.andere}`, heute.gemeinschaft.anteil[andere].betragCent, mit.gemeinschaft.anteil[andere].betragCent)
			]
		},
		{ titel: 'Daueraufträge', zeilen: auftraege },
		{
			titel: 'Rücklagen',
			zeilen: nachName(
				heute.rueckstellungen.map((r) => ({ name: r.eintrag.name, betragCent: r.rateCent })),
				mit.rueckstellungen.map((r) => ({ name: r.eintrag.name, betragCent: r.rateCent }))
			)
		}
	].filter((g) => g.zeilen.length);
}
