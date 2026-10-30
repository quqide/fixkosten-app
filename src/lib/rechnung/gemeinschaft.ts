import { berechneFixkosten, type FixkostenPosten } from './fixkosten';
import type { IsoDatum } from './datum';
import { runde, type Rundung } from './rundung';

/**
 * A: jede Person trägt die Kosten anteilig nach Netto.
 * B: beiden bleibt nach der Überweisung gleich viel übrig.
 */
export type Aufteilungsmodell = 'A' | 'B';

/** Ein Teil der Gemeinschaftssumme, z. B. Miete oder Lebensmittel. */
export interface Position {
	name: string;
	/** fest: eingegebener Betrag; fixkosten: aus den gemeinsamen Fixkosten berechnet. */
	art: 'fest' | 'fixkosten';
	betragCent: number;
}

export interface Gemeinschaftskonto {
	positionen: Position[];
	/** Gemeinsame Fixkosten wie Internet oder Rundfunkbeitrag, mit Intervallen. */
	fixkosten: FixkostenPosten[];
	modell: Aufteilungsmodell;
	/** Rundung der beiden Anteile; Standard: auf volle Euro aufrunden. */
	rundung?: Rundung;
}

export const STANDARD_ANTEIL_RUNDUNG: Rundung = { schritt: 100, richtung: 'auf' };

export interface Person {
	name: string;
	nettoCent: number;
}

export interface Anteil {
	name: string;
	/** Anteil an den gemeinsamen Gehältern, 0–1. */
	gehaltsanteil: number;
	/** Überweisung aufs Gemeinschaftskonto, gerundet (Standard: auf volle Euro auf). */
	betragCent: number;
	/** Wie sich die Überweisung auf die Positionen verteilt; Summe = betragCent. */
	positionen: { name: string; betragCent: number }[];
}

export interface Gemeinschaftsrechnung {
	/** Monatliche Umlage der gemeinsamen Fixkosten, auf volle Euro aufgerundet. */
	fixkostenCent: number;
	gesamtCent: number;
	/** Positionen mit ihrem Monatsbetrag (Fixkosten-Position berechnet). */
	positionen: { name: string; betragCent: number }[];
	anteile: [Anteil, Anteil];
}

/** Verteilt einen Betrag anteilig auf die Positionen; Rundungsrest auf die größte. */
function verteile(betragCent: number, positionen: { name: string; betragCent: number }[], gesamtCent: number) {
	if (!positionen.length) return [];
	const teile = positionen.map((p) => ({
		name: p.name,
		betragCent: gesamtCent > 0 ? Math.round((betragCent * p.betragCent) / gesamtCent) : 0
	}));
	const rest = betragCent - teile.reduce((s, t) => s + t.betragCent, 0);
	const groesste = teile.reduce((g, t, i) => (t.betragCent > teile[g].betragCent ? i : g), 0);
	teile[groesste].betragCent += rest;
	return teile;
}

export function berechneGemeinschaft(
	konto: Gemeinschaftskonto,
	personen: [Person, Person],
	stichtag: IsoDatum
): Gemeinschaftsrechnung {
	// Der Überweisungstag spielt für die Monatsbeträge keine Rolle.
	const fixkostenCent = berechneFixkosten(konto.fixkosten, { stichtag, ueberweisungstag: 1 })
		.ueberweisungCent;
	const positionen = konto.positionen.map((p) => ({
		name: p.name,
		betragCent: p.art === 'fixkosten' ? fixkostenCent : p.betragCent
	}));
	const gesamtCent = positionen.reduce((s, p) => s + p.betragCent, 0);

	const [a, b] = personen;
	const summeNetto = a.nettoCent + b.nettoCent;
	const anteilA = summeNetto > 0 ? a.nettoCent / summeNetto : 0.5;

	// Ungerundeter Betrag von Person A; B trägt den Rest.
	let rohA: number;
	if (konto.modell === 'A') {
		rohA = summeNetto > 0 ? (gesamtCent * a.nettoCent) / summeNetto : gesamtCent / 2;
	} else {
		// Netto A − x = Netto B − (Gesamt − x)
		rohA = Math.min(gesamtCent, Math.max(0, (gesamtCent + a.nettoCent - b.nettoCent) / 2));
	}
	const rohB = gesamtCent - rohA;

	const rundung = konto.rundung ?? STANDARD_ANTEIL_RUNDUNG;
	const betragA = runde(rohA, rundung);
	const betragB = runde(rohB, rundung);
	return {
		fixkostenCent,
		gesamtCent,
		positionen,
		anteile: [
			{ name: a.name, gehaltsanteil: anteilA, betragCent: betragA, positionen: verteile(betragA, positionen, gesamtCent) },
			{ name: b.name, gehaltsanteil: 1 - anteilA, betragCent: betragB, positionen: verteile(betragB, positionen, gesamtCent) }
		]
	};
}
