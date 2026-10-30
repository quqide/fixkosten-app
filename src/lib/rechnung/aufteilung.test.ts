import { describe, expect, it } from 'vitest';
import { verteileWieActual } from './aufteilung';

const betraege = (m: Map<number, number>) => [...m.entries()].sort(([a], [b]) => a - b).map(([, v]) => v);

describe('Aufteilung wie Actual', () => {
	it('verteilt den Rest gleichmäßig auf die Rest-Teile', () => {
		const teile = [
			{ index: 1, methode: 'fixed-amount', wert: -3000 },
			{ index: 2, methode: 'remainder', wert: 0 },
			{ index: 3, methode: 'remainder', wert: 0 }
		];
		expect(betraege(verteileWieActual(-10000, teile))).toEqual([-3000, -3500, -3500]);
		// −70,01 / 2 = −35,005 → Math.round −35,00 je Teil, der übrige Cent auf den letzten Teil.
		expect(betraege(verteileWieActual(-10001, teile))).toEqual([-3000, -3500, -3501]);
	});

	it('gibt den Rundungscent dem Rest-Teil mit dem höchsten Index, egal in welcher Reihenfolge', () => {
		const teile = [
			{ index: 3, methode: 'remainder', wert: 0 },
			{ index: 1, methode: 'remainder', wert: 0 },
			{ index: 2, methode: 'remainder', wert: 0 }
		];
		// −100 / 3 = −33,33 → −33 je Teil, −1 übrig.
		expect(betraege(verteileWieActual(-100, teile))).toEqual([-33, -33, -34]);
	});

	it('rechnet Prozente vom Rest nach den festen Beträgen', () => {
		const teile = [
			{ index: 1, methode: 'fixed-amount', wert: -2000 },
			{ index: 2, methode: 'fixed-percent', wert: 50 },
			{ index: 3, methode: 'remainder', wert: 0 }
		];
		expect(betraege(verteileWieActual(-10000, teile))).toEqual([-2000, -4000, -4000]);
	});

	it('übernimmt feste Beträge mit ihrem Vorzeichen, wie Actual', () => {
		const teile = [
			{ index: 1, methode: 'fixed-amount', wert: 3000 },
			{ index: 2, methode: 'remainder', wert: 0 },
			{ index: 3, methode: 'remainder', wert: 0 }
		];
		expect(betraege(verteileWieActual(-10000, teile))).toEqual([3000, -6500, -6500]);
	});

	it('rundet Prozente wie Actual', () => {
		// −999,50 € × 7 %: Actual rechnet −99950 × 0,07 → −69,97 €; (−99950 × 7) / 100 ergäbe −69,96 €.
		const teile = [{ index: 1, methode: 'fixed-percent', wert: 7 }];
		expect(verteileWieActual(-99950, teile).get(1)).toBe(-6997);
	});

	it('lässt ohne Rest-Teil offen, was nicht verteilt ist', () => {
		const teile = [{ index: 1, methode: 'fixed-amount', wert: -3000 }, { index: 2, methode: 'formula', wert: 0 }];
		expect(betraege(verteileWieActual(-10000, teile))).toEqual([-3000, 0]);
	});
});
