import {
	formatDatum,
	monatsNummer,
	parseDatum,
	plusMonate,
	tagImMonat,
	vergleiche,
	type IsoDatum,
	type Tag
} from './datum';

export const ARTEN = ['50 (Lebenshaltung)', '30 (Freizeit)', '20 (Sparen)'] as const;
export type Art = (typeof ARTEN)[number];

export const ABBUCHUNGSARTEN = [
	'Lastschrift',
	'Überweisung',
	'Debitkarte',
	'Kreditkarte',
	'Dauerauftrag'
] as const;
export type Abbuchungsart = (typeof ABBUCHUNGSARTEN)[number];

/** Anteil, den eine andere Person an einem Posten übernimmt und mir überweist. */
export interface Beteiligung {
	name: string;
	/** Positiver Betrag pro Abbuchung des Postens, in Cent. */
	betragCent: number;
	/** Tag im Monat, an dem das Geld eingeht, falls nicht zusammen mit der Abbuchung. */
	eingangstag?: number | null;
}

export interface FixkostenPosten {
	name: string;
	intervallMonate: number;
	/** Positiv = Ausgabe, negativ = Geld, das bei mir eingeht. In Cent. */
	betragCent: number;
	art?: Art | null;
	abbuchungsart?: Abbuchungsart | null;
	/** Irgendein echtes Abbuchungsdatum dieses Postens, Vergangenheit oder Zukunft. */
	buchungsdatum?: IsoDatum | null;
	/** Nur bei negativem Betrag: Tag, an dem das Geld eingeht. */
	eingangstag?: number | null;
	beteiligungen?: Beteiligung[];
	/** Gewähltes Symbol, sonst schlägt die App eins nach dem Namen vor. */
	icon?: string | null;
}

export interface Einstellungen {
	stichtag: IsoDatum;
	/** Tag im Monat, an dem die Daueraufträge vom Gehaltskonto rausgehen. */
	ueberweisungstag: number;
}

export interface Zeile {
	name: string;
	/** Bei Beteiligungen der Name des Postens, an dem sie hängt. */
	gehoertZu: string | null;
	intervallMonate: number;
	betragCent: number;
	art: Art | null;
	monatlichCent: number;
	letzteBuchung: IsoDatum | null;
	naechsteBuchung: IsoDatum | null;
	ratenSeitBuchung: number;
	sollCent: number;
}

export interface Fixkostenrechnung {
	zeilen: Zeile[];
	summeMonatlichCent: number;
	sollCent: number;
	/** Monatliche Überweisung aufs Fixkosten-Konto, auf volle Euro aufgerundet. */
	ueberweisungCent: number;
}

/** Ausgaben aufrunden, Eingänge abrunden, damit die Rücklage immer reicht. */
export function monatlicherBetrag(betragCent: number, intervallMonate: number): number {
	return betragCent < 0
		? -Math.floor(-betragCent / intervallMonate)
		: Math.ceil(betragCent / intervallMonate);
}

export function aufEuroAufrunden(cent: number): number {
	return Math.ceil(cent / 100) * 100;
}

export function aufEuroAbrunden(cent: number): number {
	return Math.floor(cent / 100) * 100;
}

/**
 * Letzter und nächster Abbuchungstermin um den Stichtag. Beide werden vom ursprünglichen Datum aus
 * gerechnet, damit ein Posten am 31. nach dem 30.09. wieder am 31.10. bucht.
 */
export function buchungenUm(datum: Tag, intervall: number, stichtag: Tag): { letzte: Tag; naechste: Tag } {
	const abstand = monatsNummer(stichtag) - monatsNummer(datum);
	let monate = Math.floor(abstand / intervall) * intervall;
	if (vergleiche(plusMonate(datum, monate), stichtag) > 0) monate -= intervall;
	return { letzte: plusMonate(datum, monate), naechste: plusMonate(datum, monate + intervall) };
}

/**
 * Nummer des letzten Überweisungstags am oder vor `tag`. Fällt eine Abbuchung genau auf den
 * Überweisungstag, deckt die Überweisung dieses Tages sie ab.
 */
function ueberweisungsNummer(tag: Tag, ueberweisungstag: number): number {
	return monatsNummer(tag) - (tag.t < ueberweisungstag ? 1 : 0);
}

/** Macht aus Posten mit Beteiligungen eine flache Liste, wie in der alten Tabelle. */
function flacheZeilen(posten: FixkostenPosten[]) {
	return posten.flatMap((p) => [
		{ ...p, gehoertZu: null },
		...(p.beteiligungen ?? []).map((b) => ({
			name: b.name,
			intervallMonate: p.intervallMonate,
			betragCent: -b.betragCent,
			art: p.art,
			buchungsdatum: p.buchungsdatum,
			eingangstag: b.eingangstag,
			gehoertZu: p.name
		}))
	]);
}

export function berechneFixkosten(
	posten: FixkostenPosten[],
	einstellungen: Einstellungen
): Fixkostenrechnung {
	const stichtag = parseDatum(einstellungen.stichtag);
	const t = einstellungen.ueberweisungstag;

	const zeilen = flacheZeilen(posten).map((p): Zeile => {
		if (!Number.isInteger(p.intervallMonate) || p.intervallMonate < 1) {
			throw new Error(`Intervall muss eine ganze Zahl ab 1 sein: ${p.name}`);
		}
		const monatlichCent = monatlicherBetrag(p.betragCent, p.intervallMonate);
		const basis = {
			name: p.name,
			gehoertZu: p.gehoertZu,
			intervallMonate: p.intervallMonate,
			betragCent: p.betragCent,
			art: p.art ?? null,
			monatlichCent
		};
		if (!p.buchungsdatum) {
			return { ...basis, letzteBuchung: null, naechsteBuchung: null, ratenSeitBuchung: 0, sollCent: 0 };
		}

		const { letzte, naechste } = buchungenUm(parseDatum(p.buchungsdatum), p.intervallMonate, stichtag);
		const raten = ueberweisungsNummer(stichtag, t) - ueberweisungsNummer(letzte, t);
		let sollCent = raten === 0 ? 0 : raten * monatlichCent;

		// Ist das Geld der anderen Person seit der letzten Abbuchung schon eingegangen, liegt es auf dem Konto.
		if (p.eingangstag) {
			const diesenMonat = tagImMonat(stichtag.j, stichtag.m, p.eingangstag);
			const vormonat = plusMonate({ ...stichtag, t: 1 }, -1);
			const letzterEingang =
				vergleiche(stichtag, diesenMonat) < 0
					? tagImMonat(vormonat.j, vormonat.m, p.eingangstag)
					: diesenMonat;
			if (vergleiche(letzterEingang, letzte) > 0) sollCent += -p.betragCent;
		}

		return {
			...basis,
			letzteBuchung: formatDatum(letzte),
			naechsteBuchung: formatDatum(naechste),
			ratenSeitBuchung: raten,
			sollCent
		};
	});

	const summeMonatlichCent = zeilen.reduce((s, z) => s + z.monatlichCent, 0);
	return {
		zeilen,
		summeMonatlichCent,
		sollCent: zeilen.reduce((s, z) => s + z.sollCent, 0),
		ueberweisungCent: aufEuroAufrunden(summeMonatlichCent)
	};
}
