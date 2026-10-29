import { parseDatum } from './rechnung/datum';

const MONATE = [
	'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
	'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const euroGanz = new Intl.NumberFormat('de-DE', {
	style: 'currency',
	currency: 'EUR',
	maximumFractionDigits: 0
});

export const eur = (cent: number) => euro.format(cent / 100);
export const eurGanz = (cent: number) => euroGanz.format(cent / 100);

/** Betrag für ein Eingabefeld, ohne Währungszeichen: 1234,50 */
export const betragFeld = (cent: number | null | undefined) =>
	cent == null ? '' : (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, useGrouping: false });

export function datumLang(iso: string) {
	const d = parseDatum(iso);
	return `${d.t}. ${MONATE[d.m - 1]} ${d.j}`;
}

export function datumKurz(iso: string) {
	const d = parseDatum(iso);
	return `${d.t}. ${MONATE[d.m - 1]}`;
}

export function datumKnapp(iso: string) {
	const d = parseDatum(iso);
	const m = MONATE[d.m - 1];
	return `${d.t}. ${m.length > 4 ? `${m.slice(0, 3)}.` : m}`;
}

export const monatsKuerzel = (m: number) => MONATE[m - 1].slice(0, 3);

export function inTagen(iso: string, heute: string) {
	const a = parseDatum(heute);
	const b = parseDatum(iso);
	const n = Math.round((Date.UTC(b.j, b.m - 1, b.t) - Date.UTC(a.j, a.m - 1, a.t)) / 864e5);
	if (n === 0) return 'heute';
	if (n === 1) return 'morgen';
	return `in ${n} Tagen`;
}

export function intervallText(monate: number) {
	switch (monate) {
		case 1: return 'monatlich';
		case 3: return 'vierteljährlich';
		case 6: return 'halbjährlich';
		case 12: return 'jährlich';
		default: return `alle ${monate} Monate`;
	}
}

export function zeitpunkt(isoZeit: string) {
	const d = new Date(isoZeit);
	const datum = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Berlin' });
	const zeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
	return `am ${datum} um ${zeit}`;
}

/** Erster Buchstabe für das runde Symbol vor einem Posten. */
export const initiale = (name: string) =>
	(name.replace(/^[^\p{L}\p{N}]+/u, '').charAt(0) || '?').toUpperCase();
