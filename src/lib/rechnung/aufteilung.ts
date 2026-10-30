/** Ein Teil einer Aufteilungsregel in Actual (splitIndex ≥ 1). */
export interface AufteilungsTeil {
	index: number;
	/** fixed-amount, fixed-percent, remainder; anderes (z. B. formula) rechnet die App nicht nach. */
	methode: string;
	/** Bei fixed-amount der Betrag in Cent, bei fixed-percent der Prozentwert (z. B. 37,5). */
	wert: number;
}

/**
 * Verteilt einen Betrag wie Actual (execSplitActions): erst die festen Beträge, dann die Prozente
 * vom Rest nach den festen Beträgen, dann den verbleibenden Rest gleichmäßig auf die Rest-Teile.
 * Was beim Runden übrig bleibt, bekommt der Rest-Teil mit dem höchsten Index.
 *
 * Gerechnet wird wie in Actual mit Vorzeichen (Ausgaben negativ), weil Math.round bei ,5 nach oben rundet.
 * Feste Beträge gehen unverändert ein, auch ein positiver Betrag in einer Ausgabe-Regel.
 * Ergebnis: Betrag je Index, mit demselben Vorzeichen wie `betrag`.
 */
export function verteileWieActual(betrag: number, teile: AufteilungsTeil[]): Map<number, number> {
	const ergebnis = new Map<number, number>(teile.map((t) => [t.index, 0]));
	const offen = () => betrag - [...ergebnis.values()].reduce((s, b) => s + b, 0);

	for (const t of teile) if (t.methode === 'fixed-amount') ergebnis.set(t.index, t.wert);
	const nachFesten = offen();
	// Genau wie Actual klammern, sonst weicht das Runden bei Gleitkomma um einen Cent ab.
	for (const t of teile) if (t.methode === 'fixed-percent') ergebnis.set(t.index, Math.round(nachFesten * (t.wert / 100)));
	const rest = teile.filter((t) => t.methode === 'remainder');
	if (rest.length) {
		const jeTeil = Math.round(offen() / rest.length);
		for (const t of rest) ergebnis.set(t.index, jeTeil);
		const letzter = Math.max(...rest.map((t) => t.index));
		ergebnis.set(letzter, ergebnis.get(letzter)! + offen());
	}
	return ergebnis;
}
