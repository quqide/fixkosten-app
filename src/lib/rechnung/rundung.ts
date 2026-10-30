/** Wie ein berechneter Betrag gerundet wird. Schritt in Cent, z. B. 1000 für „auf 10 €“. */
export interface Rundung {
	schritt: number;
	richtung: 'auf' | 'ab' | 'kaufm';
}

export const SCHRITTE = [1, 100, 500, 1000, 5000, 10000] as const;

export const KEINE_RUNDUNG: Rundung = { schritt: 1, richtung: 'kaufm' };

export function runde(cent: number, r: Rundung | null | undefined): number {
	if (!r || r.schritt <= 1) return Math.round(cent);
	const n = cent / r.schritt;
	// Kleine Fließkommareste nicht zum Aufrunden zählen lassen (690,0000001 → 690).
	const glatt = Math.round(n * 1e6) / 1e6;
	const gerundet = r.richtung === 'auf' ? Math.ceil(glatt) : r.richtung === 'ab' ? Math.floor(glatt) : Math.round(glatt);
	return gerundet * r.schritt;
}

export function rundungText(r: Rundung | null | undefined): string {
	if (!r || r.schritt <= 1) return 'centgenau';
	const euro = (r.schritt / 100).toLocaleString('de-DE');
	const wie = r.richtung === 'auf' ? 'aufgerundet' : r.richtung === 'ab' ? 'abgerundet' : 'gerundet';
	return `auf ${euro} € ${wie}`;
}
