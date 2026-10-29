/**
 * Liest einen Betrag, wie ihn Menschen tippen: „34,95“, „1.252,92 €“, „1252.92“, „-5“.
 * Ergebnis in Cent, oder null wenn es keine Zahl ist.
 */
export function leseBetrag(text: string | null | undefined): number | null {
	if (text == null) return null;
	let s = String(text).replace(/[€\s ]/g, '');
	if (s === '') return null;
	if (s.includes(',')) {
		s = s.replace(/\./g, '').replace(',', '.');
	} else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
		s = s.replace(/\./g, '');
	}
	if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
	return Math.round(Number(s) * 100);
}

export function leseGanzzahl(text: string | null | undefined): number | null {
	if (text == null || String(text).trim() === '') return null;
	const n = Number(String(text).replace(/[.\s]/g, '').replace(',', '.'));
	return Number.isInteger(n) ? n : null;
}

export function leseProzent(text: string | null | undefined): number | null {
	if (text == null) return null;
	const s = String(text).replace(/[%\s]/g, '').replace(',', '.');
	if (s === '') return null;
	const n = Number(s);
	return Number.isFinite(n) ? n : null;
}
