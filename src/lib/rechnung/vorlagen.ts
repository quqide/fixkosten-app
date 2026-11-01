/**
 * Zeilen für die Budget-Vorlagen in Actual („#template …“ in der Notiz einer Kategorie), damit Actual
 * dieselben Raten budgetiert wie die App. Die App schreibt nichts nach Actual; man kopiert die Zeilen selbst.
 * Schreibweise: https://actualbudget.org/docs/experimental/goal-templates/ (Simple, By, Schedule).
 */
import type { IsoDatum } from './datum';
import type { RueckstellungsArt } from './rueckstellung';

export interface VorlagenTerminplan {
	name: string;
	kategorieId: string | null;
}

export interface VorlagenRueckstellung {
	name: string;
	art: RueckstellungsArt;
	aktiv: boolean;
	kategorieId: string | null;
	/** Monatsbetrag bei „fest“ und „ziel“. */
	betragCent: number;
	/** Zielbetrag (bei „ziel“ mit Faktor schon ausgerechnet). */
	zielCent: number | null;
	faellig: IsoDatum | null;
}

export interface VorlagenZeile {
	text: string;
	/** Woher die Zeile kommt, für die Anzeige. */
	quelle: string;
}

export interface VorlagenGruppe {
	kategorieId: string;
	kategorie: string;
	zeilen: VorlagenZeile[];
}

/** Betrag ohne Währungszeichen und Tausenderpunkt, mit Punkt als Dezimaltrenner: 1250 oder 12.50. */
export function vorlagenBetrag(cent: number): string {
	return cent % 100 === 0 ? String(cent / 100) : (cent / 100).toFixed(2);
}

/** Die Vorlage für eine Rückstellung, oder null (pausiert, ohne Kategorie, ohne Ziel). */
export function rueckstellungsVorlage(r: VorlagenRueckstellung): string | null {
	if (!r.aktiv || !r.kategorieId) return null;
	if (r.art === 'fest') return `#template ${vorlagenBetrag(r.betragCent)}`;
	if (r.art === 'faellig') {
		if (r.zielCent == null || !r.faellig) return null;
		return `#template ${vorlagenBetrag(r.zielCent)} by ${r.faellig.slice(0, 7)}`;
	}
	return r.zielCent == null
		? `#template ${vorlagenBetrag(r.betragCent)}`
		: `#template ${vorlagenBetrag(r.betragCent)} up to ${vorlagenBetrag(r.zielCent)}`;
}

/**
 * Vorlagen je Actual-Kategorie, nach Kategoriename sortiert. Terminpläne ohne Kategorie kommen in eine
 * eigene Liste, weil sie erst in Actual einer Kategorie zugeordnet werden müssen.
 */
export function erzeugeVorlagen(e: {
	terminplaene: VorlagenTerminplan[];
	rueckstellungen: VorlagenRueckstellung[];
	kategorien: { id: string; name: string }[];
}): { gruppen: VorlagenGruppe[]; ohneKategorie: string[] } {
	const gruppen = new Map<string, VorlagenGruppe>();
	const gruppe = (id: string) => {
		let g = gruppen.get(id);
		if (!g) {
			g = { kategorieId: id, kategorie: e.kategorien.find((k) => k.id === id)?.name ?? 'Unbekannte Kategorie', zeilen: [] };
			gruppen.set(id, g);
		}
		return g;
	};
	const ohneKategorie: string[] = [];
	for (const t of e.terminplaene) {
		// Der Name muss in Actual exakt stimmen, deshalb unverändert.
		if (t.kategorieId) gruppe(t.kategorieId).zeilen.push({ text: `#template schedule ${t.name}`, quelle: `Fixkosten „${t.name}“` });
		else ohneKategorie.push(t.name);
	}
	for (const r of e.rueckstellungen) {
		const text = rueckstellungsVorlage(r);
		if (text) gruppe(r.kategorieId!).zeilen.push({ text, quelle: `Rücklage „${r.name}“` });
	}
	return {
		gruppen: [...gruppen.values()].sort((a, b) => a.kategorie.localeCompare(b.kategorie, 'de')),
		ohneKategorie
	};
}

/** Was der Kopieren-Knopf einer Kategorie in die Zwischenablage legt. */
export const vorlagenText = (g: VorlagenGruppe) => g.zeilen.map((z) => z.text).join('\n');
