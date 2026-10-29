export type Deckung = 'unterdeckt' | 'passt' | 'ueberdeckt';

export interface SollIstEingaben {
	sollCent: number;
	istCent: number;
	/**
	 * Geld, das schon auf dem Konto liegt, aber noch per Dauerauftrag rausgeht
	 * (Modus 1: Gehalt ist da, Daueraufträge noch nicht gebucht).
	 */
	ausstehendCent?: number;
	/** Bis zu diesem Überschuss gilt das Konto als passend. */
	pufferCent?: number;
	/** So viel darf das Konto unter dem Soll liegen (Rundung). */
	toleranzCent?: number;
}

export interface SollIstVergleich {
	istBereinigtCent: number;
	differenzCent: number;
	status: Deckung;
	/** Bei Überdeckung: Betrag, der entnommen werden kann, ohne die Rücklage anzutasten. */
	entnehmbarCent: number;
}

export const STANDARD_PUFFER_CENT = 2500;

export function vergleicheSollIst(e: SollIstEingaben): SollIstVergleich {
	const istBereinigtCent = e.istCent - (e.ausstehendCent ?? 0);
	const differenzCent = istBereinigtCent - e.sollCent;
	const puffer = e.pufferCent ?? STANDARD_PUFFER_CENT;
	const toleranz = e.toleranzCent ?? 100;

	const status: Deckung =
		differenzCent < -toleranz ? 'unterdeckt' : differenzCent > puffer ? 'ueberdeckt' : 'passt';
	return {
		istBereinigtCent,
		differenzCent,
		status,
		entnehmbarCent: Math.max(0, differenzCent)
	};
}
