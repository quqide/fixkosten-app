import type { Dauerauftrag } from './aufstellung';

/** Eine Buchung, wie sie aus Actual Budget kommt (Ausgaben negativ). */
export interface Buchung {
	datum: string;
	betragCent: number;
	text: string;
	kategorie?: string | null;
	/** Terminplan in Actual, aus dem die Buchung stammt. */
	terminplan?: string | null;
}

export interface AbgleichEingaben {
	/** Buchungen des laufenden Monats bis zum Stichtag. */
	buchungen: Buchung[];
	nettoCent: number;
	dauerauftraege: Dauerauftrag[];
	/** So weit darf eine Buchung vom Dauerauftrag abweichen. */
	toleranzCent?: number;
	/** Ist sie gesetzt, zählt nur eine Gutschrift in dieser Kategorie als Gehalt. */
	gehaltKategorie?: string | null;
	/** Dauerauftrag (Name) → Terminplan in Actual. Erkennung dann über den Terminplan statt den Betrag. */
	terminplaene?: Map<string, string>;
}

export interface AuftragAbgleich extends Dauerauftrag {
	gebucht: Buchung | null;
}

export interface Abgleich {
	gehalt: Buchung | null;
	auftraege: AuftragAbgleich[];
	/** Noch nicht gebuchte Daueraufträge, die schon im Kontostand stecken. */
	ausstehendCent: number;
}

/** Ab diesem Anteil am Netto gilt eine Gutschrift als Gehalt. */
const GEHALT_MINDESTANTEIL = 0.7;

/**
 * Erkennt im Monat das Gehalt und die schon gebuchten Daueraufträge.
 * Ist das Gehalt da, zählt alles Ungebuchte als ausstehend; ohne Gehalt ist
 * weder das Geld noch der Abgang im Kontostand, also steht nichts aus.
 */
export function gleicheAb(e: AbgleichEingaben): Abgleich {
	const toleranz = e.toleranzCent ?? 100;
	const gutschriften = e.gehaltKategorie
		? e.buchungen.filter((b) => b.betragCent > 0 && b.kategorie === e.gehaltKategorie)
		: e.nettoCent > 0
			? e.buchungen.filter((b) => b.betragCent >= e.nettoCent * GEHALT_MINDESTANTEIL)
			: [];
	const gehalt = [...gutschriften].sort((x, y) => y.betragCent - x.betragCent)[0] ?? null;

	const frei = e.buchungen.filter((b) => b.betragCent < 0);
	const gebucht = new Map<Dauerauftrag, Buchung>();
	const vergib = (auftrag: Dauerauftrag, i: number) => gebucht.set(auftrag, frei.splice(i, 1)[0]);

	// Zuerst über den Terminplan, der ist eindeutig.
	for (const auftrag of e.dauerauftraege) {
		const id = e.terminplaene?.get(auftrag.name);
		if (!id) continue;
		const i = frei.findIndex((b) => b.terminplan === id);
		if (i >= 0) vergib(auftrag, i);
	}
	// Den Rest am Betrag: größte Aufträge zuerst, jede Buchung nur einmal.
	for (const auftrag of [...e.dauerauftraege].sort((x, y) => y.betragCent - x.betragCent)) {
		if (auftrag.betragCent <= 0 || gebucht.has(auftrag)) continue;
		let beste = -1;
		let besteAbweichung = Infinity;
		frei.forEach((b, i) => {
			const abweichung = Math.abs(-b.betragCent - auftrag.betragCent);
			if (abweichung <= toleranz && abweichung < besteAbweichung) {
				beste = i;
				besteAbweichung = abweichung;
			}
		});
		if (beste >= 0) vergib(auftrag, beste);
	}

	const auftraege = e.dauerauftraege.map((a) => ({ ...a, gebucht: gebucht.get(a) ?? null }));
	const ausstehendCent = gehalt
		? auftraege.filter((a) => !a.gebucht).reduce((s, a) => s + a.betragCent, 0)
		: 0;
	return { gehalt, auftraege, ausstehendCent };
}
