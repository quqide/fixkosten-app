import { berechneFixkosten, type FixkostenPosten } from './fixkosten';
import { formatDatum, parseDatum, type IsoDatum } from './datum';

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
