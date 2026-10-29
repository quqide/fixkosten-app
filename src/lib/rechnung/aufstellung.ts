import { aufEuroAbrunden, aufEuroAufrunden } from './fixkosten';

/**
 * 1: Fixkosten gehen direkt vom Gehaltskonto ab, aufs Spaßkonto geht ein fester Betrag.
 * 2: Fixkosten laufen über ein eigenes Fixkosten-Konto, der Rest auf dem Gehaltskonto ist Spaß.
 */
export type Kontenmodus = 1 | 2;

export interface Rueckstellung {
	name: string;
	betragCent: number;
	zielkonto?: string | null;
}

export interface AufstellungEingaben {
	modus: Kontenmodus;
	nettoCent: number;
	/** z. B. 20 für 20 %. */
	etfQuoteProzent: number;
	rueckstellungen: Rueckstellung[];
	/** Eigener Anteil am Gemeinschaftskonto. */
	gemeinschaftCent: number;
	/** Summe der monatlichen Fixkosten-Beträge (ungerundet). */
	fixkostenMonatlichCent: number;
}

export interface Dauerauftrag {
	name: string;
	zielkonto: string;
	betragCent: number;
}

export interface Monatsaufstellung {
	etfCent: number;
	rueckstellungenCent: number;
	/** Was im Monat für Fixkosten eingeplant ist. */
	fixkostenCent: number;
	/** Frei verfügbar: in Modus 1 der Dauerauftrag aufs Spaßkonto, in Modus 2 der Rest. */
	spassCent: number;
	/** Bleibt nach den Daueraufträgen auf dem Gehaltskonto. */
	verbleibtAufGehaltskontoCent: number;
	dauerauftraege: Dauerauftrag[];
	warnungen: string[];
}

export function berechneAufstellung(e: AufstellungEingaben): Monatsaufstellung {
	const etfCent = Math.round((e.nettoCent * e.etfQuoteProzent) / 100 / 100) * 100;
	const rueckstellungenCent = e.rueckstellungen.reduce((s, r) => s + r.betragCent, 0);

	const dauerauftraege: Dauerauftrag[] = [];
	let fixkostenCent: number;
	let spassCent: number;

	if (e.modus === 2) {
		fixkostenCent = aufEuroAufrunden(e.fixkostenMonatlichCent);
		dauerauftraege.push({ name: 'Fixkosten', zielkonto: 'Fixkosten-Konto', betragCent: fixkostenCent });
	} else {
		fixkostenCent = e.fixkostenMonatlichCent;
	}

	dauerauftraege.push({ name: 'ETF-Sparplan', zielkonto: 'Depot', betragCent: etfCent });
	for (const r of e.rueckstellungen) {
		if (r.betragCent !== 0) {
			dauerauftraege.push({ name: r.name, zielkonto: r.zielkonto ?? '', betragCent: r.betragCent });
		}
	}
	dauerauftraege.push({
		name: 'Gemeinschaftskonto',
		zielkonto: 'Gemeinschaftskonto',
		betragCent: e.gemeinschaftCent
	});

	const rest = e.nettoCent - etfCent - rueckstellungenCent - e.gemeinschaftCent - fixkostenCent;
	if (e.modus === 1) {
		// Abrunden, damit die Fixkosten-Rücklage auf dem Gehaltskonto nie zu knapp wird.
		spassCent = Math.max(0, aufEuroAbrunden(rest));
		dauerauftraege.push({ name: 'Spaßkonto', zielkonto: 'Spaßkonto', betragCent: spassCent });
	} else {
		spassCent = rest;
	}

	const summeDauerauftraege = dauerauftraege.reduce((s, d) => s + d.betragCent, 0);
	const warnungen: string[] = [];
	if (rest < 0) {
		warnungen.push('Die Ausgaben sind höher als das Netto. Es bleibt nichts frei verfügbar.');
	}

	return {
		etfCent,
		rueckstellungenCent,
		fixkostenCent,
		spassCent,
		verbleibtAufGehaltskontoCent: e.nettoCent - summeDauerauftraege,
		dauerauftraege,
		warnungen
	};
}
