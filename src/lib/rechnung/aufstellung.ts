import { aufEuroAufrunden } from './fixkosten';
import { runde, rundungText, type Rundung } from './rundung';

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

/** Woraus sich ein Dauerauftrag zusammensetzt. */
export type Baustein =
	| { typ: 'fest'; betragCent: number }
	/** Prozent vom Netto, z. B. der ETF-Sparplan. */
	| { typ: 'prozent'; prozent: number }
	/** Der eigene Anteil am Gemeinschaftskonto. */
	| { typ: 'gemeinschaft' }
	/** Alle Rücklagen mit diesem Ziel (Konto oder WKN). */
	| { typ: 'ruecklagen'; ziel: string }
	/** Die Monatsrate fürs Fixkosten-Konto, auf volle Euro aufgerundet. */
	| { typ: 'fixkosten' }
	/** Was nach allen anderen Aufträgen (und in Modus 1 den Fixkosten) übrig bleibt. */
	| { typ: 'rest' };

export interface AuftragKonfig {
	name: string;
	zielkonto: string;
	bausteine: Baustein[];
	rundung?: Rundung | null;
}

export interface AufstellungEingaben {
	modus: Kontenmodus;
	nettoCent: number;
	auftraege: AuftragKonfig[];
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
	/** Was im Monat für Fixkosten eingeplant ist. */
	fixkostenCent: number;
	/** Frei verfügbar: der Rest-Auftrag (Spaßkonto) oder was auf dem Gehaltskonto frei bleibt. */
	spassCent: number;
	/** Bleibt nach den Daueraufträgen auf dem Gehaltskonto. */
	verbleibtAufGehaltskontoCent: number;
	dauerauftraege: Dauerauftrag[];
	warnungen: string[];
}

export const STANDARD_REST_RUNDUNG: Rundung = { schritt: 100, richtung: 'ab' };
const ETF_RUNDUNG: Rundung = { schritt: 100, richtung: 'kaufm' };

const istRest = (a: AuftragKonfig) => a.bausteine.some((b) => b.typ === 'rest');
const ziel = (r: Rueckstellung) => (r.zielkonto ?? '').trim();
/** Ziele vergleichen ohne Rücksicht auf Groß- und Kleinschreibung, z. B. WKN „a0rpwh“ und „A0RPWH“. */
const gleichesZiel = (a: string, b: string) => a.trim().toLocaleUpperCase('de-DE') === b.trim().toLocaleUpperCase('de-DE');

/** Die Daueraufträge, wie sie die App ohne eigene Einrichtung anlegt. */
export function standardAuftraege(
	modus: Kontenmodus,
	etfProzent: number,
	rueckstellungen: Rueckstellung[]
): AuftragKonfig[] {
	const liste: AuftragKonfig[] = [];
	if (modus === 2) liste.push({ name: 'Fixkosten', zielkonto: 'Fixkosten-Konto', bausteine: [{ typ: 'fixkosten' }] });
	liste.push({ name: 'ETF-Sparplan', zielkonto: 'Depot', bausteine: [{ typ: 'prozent', prozent: etfProzent }], rundung: ETF_RUNDUNG });
	const ziele = new Map<string, Rueckstellung[]>();
	for (const r of rueckstellungen) {
		const schluessel = ziel(r).toLocaleUpperCase('de-DE');
		ziele.set(schluessel, [...(ziele.get(schluessel) ?? []), r]);
	}
	for (const liste_ of ziele.values()) {
		const z = ziel(liste_[0]);
		liste.push({
			name: liste_.length === 1 ? liste_[0].name : `Rücklagen ${z}`.trim(),
			zielkonto: z,
			bausteine: [{ typ: 'ruecklagen', ziel: z }]
		});
	}
	liste.push({ name: 'Gemeinschaftskonto', zielkonto: 'Gemeinschaftskonto', bausteine: [{ typ: 'gemeinschaft' }] });
	if (modus === 1) {
		liste.push({ name: 'Spaßkonto', zielkonto: 'Spaßkonto', bausteine: [{ typ: 'rest' }], rundung: STANDARD_REST_RUNDUNG });
	}
	return liste;
}

export function bausteinWert(b: Baustein, e: AufstellungEingaben): number {
	switch (b.typ) {
		case 'fest':
			return b.betragCent;
		case 'prozent':
			return (e.nettoCent * b.prozent) / 100;
		case 'gemeinschaft':
			return e.gemeinschaftCent;
		case 'ruecklagen':
			return e.rueckstellungen.filter((r) => gleichesZiel(ziel(r), b.ziel)).reduce((s, r) => s + r.betragCent, 0);
		case 'fixkosten':
			return aufEuroAufrunden(e.fixkostenMonatlichCent);
		case 'rest':
			return 0;
	}
}

export function berechneAufstellung(e: AufstellungEingaben): Monatsaufstellung {
	const warnungen: string[] = [];
	const betraege = new Map<AuftragKonfig, number>();
	for (const a of e.auftraege) {
		if (istRest(a)) continue;
		const roh = a.bausteine.reduce((s, b) => s + bausteinWert(b, e), 0);
		betraege.set(a, Math.max(0, runde(roh, a.rundung)));
	}
	const summeFest = [...betraege.values()].reduce((s, b) => s + b, 0);
	const fixkostenBleiben = e.modus === 1 ? e.fixkostenMonatlichCent : 0;
	const rest = e.nettoCent - summeFest - fixkostenBleiben;

	const restAuftraege = e.auftraege.filter(istRest);
	if (restAuftraege.length > 1) warnungen.push('Nur ein Dauerauftrag kann den Rest bekommen. Die weiteren bekommen nichts.');
	restAuftraege.forEach((a, i) => {
		betraege.set(a, i === 0 ? Math.max(0, runde(rest, a.rundung ?? STANDARD_REST_RUNDUNG)) : 0);
	});
	if (rest < 0) warnungen.push('Die Ausgaben sind höher als das Netto. Es bleibt nichts frei verfügbar.');

	const hatFixkostenRate = e.auftraege.some((a) => a.bausteine.some((b) => b.typ === 'fixkosten'));
	if (e.modus === 2 && !hatFixkostenRate) {
		warnungen.push('Im Modell „Eigenes Fixkosten-Konto“ fehlt der Dauerauftrag mit der Fixkosten-Rate.');
	}
	if (e.modus === 1 && hatFixkostenRate) {
		// Die Fixkosten bleiben in Modus 1 auf dem Gehaltskonto; eine Rate würde sie doppelt abziehen.
		warnungen.push(
			'Im Modell „Spaßkonto mit festem Betrag“ bleiben die Fixkosten auf dem Gehaltskonto. Der Dauerauftrag mit der Fixkosten-Rate zieht sie doppelt ab.'
		);
	}
	const abgedeckt = e.auftraege.flatMap((a) => a.bausteine.flatMap((b) => (b.typ === 'ruecklagen' ? [b.ziel] : [])));
	for (const r of e.rueckstellungen) {
		if (r.betragCent !== 0 && !abgedeckt.some((z) => gleichesZiel(z, ziel(r)))) {
			warnungen.push(`Die Rücklage „${r.name}“ (Ziel ${ziel(r) || 'ohne Konto'}) überweist kein Dauerauftrag.`);
		}
	}

	const dauerauftraege = e.auftraege.map((a) => ({ name: a.name, zielkonto: a.zielkonto, betragCent: betraege.get(a) ?? 0 }));
	const summe = dauerauftraege.reduce((s, d) => s + d.betragCent, 0);
	const verbleibt = e.nettoCent - summe;
	return {
		fixkostenCent: e.modus === 2 ? aufEuroAufrunden(e.fixkostenMonatlichCent) : e.fixkostenMonatlichCent,
		spassCent: restAuftraege.length ? (betraege.get(restAuftraege[0]) ?? 0) : Math.max(0, verbleibt - fixkostenBleiben),
		verbleibtAufGehaltskontoCent: verbleibt,
		dauerauftraege,
		warnungen
	};
}

/** Kurzbeschreibung eines Dauerauftrags für die Oberfläche, z. B. „20 % vom Netto, auf 10 € aufgerundet“. */
export function beschreibeAuftrag(a: AuftragKonfig): string {
	const teile = a.bausteine.map((b) => {
		switch (b.typ) {
			case 'fest':
				return `${(b.betragCent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} fest`;
			case 'prozent':
				return `${b.prozent.toLocaleString('de-DE')} % vom Netto`;
			case 'gemeinschaft':
				return 'dein Anteil am Gemeinschaftskonto';
			case 'ruecklagen':
				return b.ziel ? `Rücklagen mit Ziel ${b.ziel}` : 'Rücklagen ohne Ziel';
			case 'fixkosten':
				return 'Rate für deine Fixkosten';
			case 'rest':
				return 'was übrig bleibt';
		}
	});
	const rundung = a.rundung && a.rundung.schritt > 1 ? `, ${rundungText(a.rundung)}` : '';
	return teile.join(' + ') + rundung;
}
