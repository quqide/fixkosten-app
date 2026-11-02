/**
 * Rücklagen (im Code „Rückstellungen“) für Liste und Bearbeitungsfenster: Klartext, Zustand und
 * der Entwurf mit Beträgen als Text, so wie die Action `rueckstellungen` ihn liest.
 */
import { betragFeld, eurGanz } from '#lib/format.ts';
import type { RueckstellungKonfig, RueckstellungStand } from '#lib/rechnung/rueckstellung.ts';

export type RuecklageArt = RueckstellungKonfig['art'];

export interface RuecklageEntwurf {
	id?: number;
	name: string;
	art: RuecklageArt;
	betrag: string;
	zielArt: 'betrag' | 'netto';
	ziel: string;
	faellig: string;
	wohinArt: 'konto' | 'wkn';
	wohin: string;
	aktiv: boolean;
	kategorie: string;
	stand: string;
}

/** Was die Liste je Rücklage bekommt: die gespeicherte Rücklage und ihr berechneter Stand. */
export type RuecklageMitStand = RueckstellungStand & {
	eintrag: RueckstellungKonfig & { id?: number; actualKategorie: string | null; standCent: number | null };
	standQuelle?: 'actual' | 'hand' | null;
	hinweis?: string | null;
};

export const RUECKLAGE_ARTEN = [
	{ wert: 'fest', name: 'Fester Betrag' },
	{ wert: 'faellig', name: 'Bis Datum' },
	{ wert: 'ziel', name: 'Bis Ziel' }
] as const;

export function zuEntwurf(r: RuecklageMitStand['eintrag']): RuecklageEntwurf {
	return {
		id: r.id,
		name: r.name,
		art: r.art,
		betrag: r.art === 'faellig' ? '' : betragFeld(r.betragCent),
		zielArt: r.zielNettoFaktor ? 'netto' : 'betrag',
		ziel: r.zielNettoFaktor ? r.zielNettoFaktor.toLocaleString('de-DE') : r.zielCent != null ? betragFeld(r.zielCent) : '',
		faellig: r.faellig ?? '',
		wohinArt: r.wkn ? 'wkn' : 'konto',
		wohin: r.wkn ?? r.zielkonto ?? '',
		aktiv: r.aktiv,
		kategorie: r.actualKategorie ?? '',
		stand: r.standCent != null ? betragFeld(r.standCent) : ''
	};
}

export const neuerEntwurf = (): RuecklageEntwurf => ({
	name: '', art: 'fest', betrag: '', zielArt: 'betrag', ziel: '', faellig: '', wohinArt: 'konto', wohin: '', aktiv: true, kategorie: '', stand: ''
});

/** „läuft“, „erreicht“, „pausiert“ oder „fällig“ (Fälligkeit vorbei). */
export function zustand(s: Pick<RueckstellungStand, 'status'>): 'läuft' | 'erreicht' | 'pausiert' | 'fällig' {
	if (s.status === 'pausiert') return 'pausiert';
	if (s.status === 'erreicht') return 'erreicht';
	if (s.status === 'faellig') return 'fällig';
	return 'läuft';
}

/** Füllung des Rings: Stand zum Ziel; ohne Ziel oder ohne Stand leer. */
export const ringAnteil = (s: Pick<RueckstellungStand, 'fortschritt'>) => s.fortschritt ?? 0;

const wohin = (r: RueckstellungKonfig) => (r.wkn ? ` in ${r.wkn}` : r.zielkonto ? ` aufs ${r.zielkonto}` : '');

/** „fester Betrag aufs Tagesgeld“, „6.300 € von 10.350 € (3 × Netto)“, „bis 03/2029“ */
export function artText(r: RuecklageMitStand): string {
	const e = r.eintrag;
	if (e.art === 'fest') return `fester Betrag${wohin(e)}`;
	const faktor = e.zielNettoFaktor ? ` (${e.zielNettoFaktor.toLocaleString('de-DE')} × Netto)` : '';
	const ziel = r.zielCent != null ? (r.standCent != null ? `${eurGanz(r.standCent)} von ${eurGanz(r.zielCent)}` : `Ziel ${eurGanz(r.zielCent)}`) + faktor : '';
	if (e.art === 'ziel') return ziel || `bis zum Ziel${wohin(e)}`;
	const bis = e.faellig ? `bis ${e.faellig.slice(5, 7)}/${e.faellig.slice(0, 4)}` : '';
	return [ziel, bis].filter(Boolean).join(', ');
}
