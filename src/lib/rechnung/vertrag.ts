import { formatDatum, parseDatum, plusMonate, tageImMonat, vergleiche, type IsoDatum, type Tag } from './datum';

export type FristEinheit = 'tage' | 'wochen' | 'monate';
export const FRIST_EINHEITEN: readonly FristEinheit[] = ['tage', 'wochen', 'monate'];

/** Vertragsangaben, die nur die App kennt (nicht aus Actual). Alle Felder optional. */
export interface Vertrag {
	laufzeitEnde: IsoDatum | null;
	kuendigungsfrist: { anzahl: number; einheit: FristEinheit } | null;
	/** Automatische Verlängerung in Monaten; null = keine. */
	verlaengerungMonate: number | null;
	kundennummer: string | null;
	notiz: string | null;
}

export const LEERER_VERTRAG: Vertrag = {
	laufzeitEnde: null,
	kuendigungsfrist: null,
	verlaengerungMonate: null,
	kundennummer: null,
	notiz: null
};

export const istLeer = (v: Vertrag | null | undefined) =>
	!v || (!v.laufzeitEnde && !v.kuendigungsfrist && !v.verlaengerungMonate && !v.kundennummer && !v.notiz);

export interface Kuendigung {
	/** Nächstes Laufzeitende ab Stichtag (bei Verlängerung weitergerückt). */
	laufzeitEnde: IsoDatum;
	/** Bis wann die Kündigung spätestens da sein muss. */
	letzterKuendigungstag: IsoDatum;
	status: 'laeuft' | 'abgelaufen';
}

const istMonatsende = (d: Tag) => d.t === tageImMonat(d.j, d.m);

function minusFrist(ende: Tag, frist: Vertrag['kuendigungsfrist']): Tag {
	if (!frist || frist.anzahl === 0) return ende;
	if (frist.einheit === 'monate') {
		const d = plusMonate(ende, -frist.anzahl);
		// Endet der Vertrag am Monatsende, endet auch die Frist am Monatsende (30.06. − 3 Monate → 31.03.).
		return istMonatsende(ende) ? { ...d, t: tageImMonat(d.j, d.m) } : d;
	}
	const tage = frist.einheit === 'wochen' ? 7 * frist.anzahl : frist.anzahl;
	const x = new Date(Date.UTC(ende.j, ende.m - 1, ende.t - tage));
	return { j: x.getUTCFullYear(), m: x.getUTCMonth() + 1, t: x.getUTCDate() };
}

/**
 * Nächstes Laufzeitende ab Stichtag und letzter Kündigungstag (Laufzeitende minus Frist).
 * Mit Verlängerung rückt das Ende so oft weiter, bis es nicht vor dem Stichtag liegt;
 * ohne Verlängerung ist ein vergangenes Ende „abgelaufen“. Ohne Laufzeitende: null.
 */
export function letzterKuendigungstag(v: Vertrag | null | undefined, stichtag: IsoDatum): Kuendigung | null {
	if (!v?.laufzeitEnde) return null;
	const start = parseDatum(v.laufzeitEnde);
	const heute = parseDatum(stichtag);
	let ende = start;
	let status: Kuendigung['status'] = 'laeuft';
	if (vergleiche(ende, heute) < 0) {
		if (v.verlaengerungMonate && v.verlaengerungMonate > 0) {
			// Immer vom ursprünglichen Ende aus rechnen, damit ein kurzer Monat den Tag nicht dauerhaft verschiebt.
			const schritt = v.verlaengerungMonate;
			const monate = (heute.j - start.j) * 12 + (heute.m - start.m);
			let n = Math.max(1, Math.floor(monate / schritt));
			ende = plusMonate(start, n * schritt);
			while (vergleiche(ende, heute) < 0) ende = plusMonate(start, ++n * schritt);
		} else status = 'abgelaufen';
	}
	return { laufzeitEnde: formatDatum(ende), letzterKuendigungstag: formatDatum(minusFrist(ende, v.kuendigungsfrist)), status };
}
