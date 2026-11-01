import { berechneFixkosten, buchungenUm, type FixkostenPosten } from './fixkosten';
import { formatDatum, parseDatum, plusMonate, vergleiche, type IsoDatum } from './datum';

export interface Verlaufspunkt {
	datum: IsoDatum;
	sollCent: number;
}

/** Soll-Kontostand ab `von` für die nächsten `tage` Tage, alle `schritt` Tage ein Punkt. */
export function sollVerlauf(
	posten: FixkostenPosten[],
	von: IsoDatum,
	ueberweisungstag: number,
	tage = 365,
	schritt = 2
): Verlaufspunkt[] {
	const start = parseDatum(von);
	const punkte: Verlaufspunkt[] = [];
	for (let i = 0; i <= tage; i += schritt) {
		const d = new Date(Date.UTC(start.j, start.m - 1, start.t + i));
		const datum = formatDatum({ j: d.getUTCFullYear(), m: d.getUTCMonth() + 1, t: d.getUTCDate() });
		punkte.push({ datum, sollCent: berechneFixkosten(posten, { stichtag: datum, ueberweisungstag }).sollCent });
	}
	return punkte;
}

export interface GrosseAbbuchung {
	name: string;
	datum: IsoDatum;
	/** Eigener Anteil: Betrag abzüglich der Beteiligungen anderer. */
	betragCent: number;
}

export interface AbbuchungsMonat {
	/** JJJJ-MM */
	monat: string;
	abbuchungen: GrosseAbbuchung[];
	summeCent: number;
}

/**
 * Abbuchungen von Posten, die seltener als monatlich abgehen, ab `von` für die nächsten `monate`
 * Monate, nach Monat gruppiert. Monate ohne solche Abbuchung fehlen. Es zählt der eigene Anteil.
 */
export function grosseAbbuchungen(posten: FixkostenPosten[], von: IsoDatum, monate = 12): AbbuchungsMonat[] {
	const start = parseDatum(von);
	const ende = plusMonate(start, monate);
	const alle: GrosseAbbuchung[] = [];
	for (const p of posten) {
		if (p.intervallMonate <= 1 || !p.buchungsdatum) continue;
		const eigenCent = p.betragCent - (p.beteiligungen ?? []).reduce((s, b) => s + b.betragCent, 0);
		if (eigenCent <= 0) continue;
		const basis = parseDatum(p.buchungsdatum);
		// Jeder Termin wird vom ursprünglichen Datum aus gerechnet (wie in der Fixkosten-Rechnung).
		const { letzte } = buchungenUm(basis, p.intervallMonate, start);
		let schritt = (letzte.j - basis.j) * 12 + (letzte.m - basis.m);
		for (let termin = letzte; vergleiche(termin, ende) < 0; schritt += p.intervallMonate, termin = plusMonate(basis, schritt)) {
			if (vergleiche(termin, start) >= 0) alle.push({ name: p.name, datum: formatDatum(termin), betragCent: eigenCent });
		}
	}
	alle.sort((a, b) => a.datum.localeCompare(b.datum) || a.name.localeCompare(b.name, 'de'));
	const nachMonat = new Map<string, AbbuchungsMonat>();
	for (const a of alle) {
		const monat = a.datum.slice(0, 7);
		const m = nachMonat.get(monat) ?? { monat, abbuchungen: [], summeCent: 0 };
		m.abbuchungen.push(a);
		m.summeCent += a.betragCent;
		nachMonat.set(monat, m);
	}
	return [...nachMonat.values()];
}
