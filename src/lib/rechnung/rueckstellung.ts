import { aufEuroAufrunden } from './fixkosten';
import { parseDatum, plusMonate, tagImMonat, vergleiche, type IsoDatum } from './datum';

/**
 * fest: jeden Monat derselbe Betrag.
 * faellig: ein Zielbetrag bis zu einem Datum, die Rate ergibt sich daraus (Fixkosten über mehrere Jahre).
 * ziel: ein Monatsbetrag, bis ein Zielbetrag erreicht ist (z. B. Notgroschen = 3 × Netto).
 */
export type RueckstellungsArt = 'fest' | 'faellig' | 'ziel';

export interface RueckstellungKonfig {
	name: string;
	art: RueckstellungsArt;
	/** Monatsbetrag bei „fest“ und „ziel“. */
	betragCent: number;
	/** Zielbetrag bei „faellig“ und „ziel“ (wenn kein Faktor). */
	zielCent: number | null;
	/** Bei „ziel“: Vielfaches vom Netto statt eines festen Zielbetrags. */
	zielNettoFaktor: number | null;
	faellig: IsoDatum | null;
	/** Konto, auf das das Geld geht … */
	zielkonto: string | null;
	/** … oder Wertpapier, in das der Sparplan geht. */
	wkn: string | null;
	aktiv: boolean;
}

export interface RueckstellungStand {
	/** Rate für diesen Monat (0, wenn pausiert, erreicht oder fällig vorbei). */
	rateCent: number;
	zielCent: number | null;
	standCent: number | null;
	/** Anteil erreicht, 0–1, falls ein Ziel existiert und der Stand bekannt ist. */
	fortschritt: number | null;
	/** unbekannt: Der Stand soll aus Actual kommen, liegt aber nicht vor. */
	status: 'aktiv' | 'pausiert' | 'erreicht' | 'faellig' | 'unbekannt';
	/** Raten bis zur Fälligkeit (nur „faellig“). */
	restRaten: number | null;
}

/** Ziel für Dauerauftrags-Bausteine: WKN vor Konto. */
export const zielVon = (r: Pick<RueckstellungKonfig, 'wkn' | 'zielkonto'>) => (r.wkn || r.zielkonto || '').trim();

/** Überweisungstermine (am Überweisungstag) ab dem Stichtag bis einschließlich Fälligkeit. */
export function ratenBis(stichtag: IsoDatum, faellig: IsoDatum, ueberweisungstag: number): number {
	const s = parseDatum(stichtag);
	const ende = parseDatum(faellig);
	// Immer vom Monat aus rechnen, damit ein kurzer Februar den Tag nicht dauerhaft verschiebt.
	const terminIn = (monate: number) => {
		const m = plusMonate({ j: s.j, m: s.m, t: 1 }, monate);
		return tagImMonat(m.j, m.m, ueberweisungstag);
	};
	let i = vergleiche(terminIn(0), s) < 0 ? 1 : 0;
	let n = 0;
	while (vergleiche(terminIn(i), ende) <= 0 && n < 1200) {
		n++;
		i++;
	}
	return n;
}

export function berechneRueckstellung(
	r: RueckstellungKonfig,
	e: {
		standCent: number | null;
		nettoCent: number;
		stichtag: IsoDatum;
		ueberweisungstag: number;
		/** Der Stand soll aus Actual kommen, fehlt aber. Dann nicht mit 0 € rechnen. */
		standUnbekannt?: boolean;
	}
): RueckstellungStand {
	const zielCent =
		r.art === 'fest'
			? null
			: r.art === 'ziel' && r.zielNettoFaktor
				? Math.round(r.zielNettoFaktor * e.nettoCent)
				: r.zielCent;
	const stand = e.standCent;
	const fortschritt = zielCent && stand != null ? Math.min(1, Math.max(0, stand / zielCent)) : null;
	const basis = { zielCent, standCent: stand, fortschritt, restRaten: null as number | null };

	if (!r.aktiv) return { ...basis, rateCent: 0, status: 'pausiert' };

	if (r.art === 'fest') return { ...basis, rateCent: r.betragCent, status: 'aktiv' };

	if (e.standUnbekannt) {
		// Bis Ziel: der Monatsbetrag läuft weiter, nur die Kappung am Ziel fehlt. Bis Datum: ohne Stand keine Rate.
		return { ...basis, standCent: null, fortschritt: null, rateCent: r.art === 'ziel' ? r.betragCent : 0, status: 'unbekannt' };
	}

	if (r.art === 'ziel') {
		if (zielCent != null && stand != null && stand >= zielCent) return { ...basis, rateCent: 0, status: 'erreicht' };
		// Nicht übers Ziel hinaus sparen.
		const offen = zielCent != null && stand != null ? zielCent - stand : Infinity;
		return { ...basis, rateCent: Math.min(r.betragCent, aufEuroAufrunden(offen)), status: 'aktiv' };
	}

	// faellig
	if (!r.faellig || zielCent == null) return { ...basis, rateCent: 0, status: 'aktiv' };
	const raten = ratenBis(e.stichtag, r.faellig, e.ueberweisungstag);
	const offen = Math.max(0, zielCent - (stand ?? 0));
	if (offen === 0) return { ...basis, restRaten: raten, rateCent: 0, status: 'erreicht' };
	if (raten === 0) return { ...basis, restRaten: 0, rateCent: 0, status: 'faellig' };
	return { ...basis, restRaten: raten, rateCent: aufEuroAufrunden(Math.ceil(offen / raten)), status: 'aktiv' };
}
