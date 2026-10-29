import { aufEuroAufrunden, berechneFixkosten, type FixkostenPosten } from './fixkosten';
import type { IsoDatum } from './datum';

/**
 * A: jede Person trägt die Kosten anteilig nach Netto.
 * B: beiden bleibt nach der Überweisung gleich viel übrig.
 */
export type Aufteilungsmodell = 'A' | 'B';

export interface Gemeinschaftskonto {
	mieteCent: number;
	/** Lebensmittel und Alltag, für beide zusammen. */
	alltagCent: number;
	/** Monatliche Überweisung aufs Gemeinschaftstagesgeld. */
	ruecklageCent: number;
	/** Gemeinsame Fixkosten wie Internet oder Rundfunkbeitrag, mit Intervallen. */
	fixkosten: FixkostenPosten[];
	modell: Aufteilungsmodell;
}

export interface Person {
	name: string;
	nettoCent: number;
}

export interface Anteil {
	name: string;
	/** Anteil an den gemeinsamen Gehältern, 0–1. */
	gehaltsanteil: number;
	/** Überweisung aufs Gemeinschaftskonto, auf volle Euro aufgerundet. */
	betragCent: number;
}

export interface Gemeinschaftsrechnung {
	/** Monatliche Umlage der gemeinsamen Fixkosten, auf volle Euro aufgerundet. */
	fixkostenCent: number;
	gesamtCent: number;
	anteile: [Anteil, Anteil];
}

export function berechneGemeinschaft(
	konto: Gemeinschaftskonto,
	personen: [Person, Person],
	stichtag: IsoDatum
): Gemeinschaftsrechnung {
	// Der Überweisungstag spielt für die Monatsbeträge keine Rolle.
	const fixkostenCent = berechneFixkosten(konto.fixkosten, { stichtag, ueberweisungstag: 1 })
		.ueberweisungCent;
	const gesamtCent = konto.mieteCent + konto.alltagCent + konto.ruecklageCent + fixkostenCent;

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

	return {
		fixkostenCent,
		gesamtCent,
		anteile: [
			{ name: a.name, gehaltsanteil: anteilA, betragCent: aufEuroAufrunden(Math.round(rohA)) },
			{ name: b.name, gehaltsanteil: 1 - anteilA, betragCent: aufEuroAufrunden(Math.round(rohB)) }
		]
	};
}
