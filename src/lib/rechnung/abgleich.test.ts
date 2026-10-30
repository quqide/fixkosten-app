import { describe, expect, it } from 'vitest';
import { gleicheAb, type Buchung } from './abgleich';
import type { Dauerauftrag } from './aufstellung';

const auftraege: Dauerauftrag[] = [
	{ name: 'ETF-Sparplan', zielkonto: 'Depot', betragCent: 69000 },
	{ name: 'Gemeinschaftskonto', zielkonto: 'Gemeinschaftskonto', betragCent: 69600 },
	{ name: 'Spaßkonto', zielkonto: 'Spaßkonto', betragCent: 125200 }
];
const gehalt: Buchung = { datum: '2026-10-05', betragCent: 345000, text: 'Arbeitgeber' };

describe('Abgleich mit den Buchungen', () => {
	it('vor dem Gehalt steht nichts aus', () => {
		const a = gleicheAb({ buchungen: [], nettoCent: 345000, dauerauftraege: auftraege });
		expect(a.gehalt).toBeNull();
		expect(a.ausstehendCent).toBe(0);
	});

	it('Gehalt da, Daueraufträge noch nicht: alle stehen aus', () => {
		const a = gleicheAb({ buchungen: [gehalt], nettoCent: 345000, dauerauftraege: auftraege });
		expect(a.gehalt).toEqual(gehalt);
		expect(a.ausstehendCent).toBe(263800);
	});

	it('erkennt gebuchte Daueraufträge am Betrag, auch mit Cent-Abweichung', () => {
		const a = gleicheAb({
			buchungen: [
				gehalt,
				{ datum: '2026-10-07', betragCent: -69000, text: 'Depot' },
				{ datum: '2026-10-07', betragCent: -69650, text: 'Gemeinschaft' },
				{ datum: '2026-10-08', betragCent: -1299, text: 'Netflix' }
			],
			nettoCent: 345000,
			dauerauftraege: auftraege
		});
		expect(a.auftraege.map((x) => x.gebucht?.text ?? null)).toEqual(['Depot', 'Gemeinschaft', null]);
		expect(a.ausstehendCent).toBe(125200);
	});

	it('vergibt jede Buchung nur einmal', () => {
		const a = gleicheAb({
			buchungen: [gehalt, { datum: '2026-10-07', betragCent: -10000, text: 'Tagesgeld' }],
			nettoCent: 345000,
			dauerauftraege: [
				{ name: 'Rücklage 1', zielkonto: '', betragCent: 10000 },
				{ name: 'Rücklage 2', zielkonto: '', betragCent: 10000 }
			]
		});
		expect(a.auftraege.filter((x) => x.gebucht)).toHaveLength(1);
		expect(a.ausstehendCent).toBe(10000);
	});

	it('kleine Gutschriften zählen nicht als Gehalt', () => {
		const a = gleicheAb({
			buchungen: [{ datum: '2026-10-03', betragCent: 5000, text: 'Erstattung' }],
			nettoCent: 345000,
			dauerauftraege: auftraege
		});
		expect(a.gehalt).toBeNull();
	});

	it('mit Gehaltskategorie zählt eine große Umbuchung nicht als Gehalt', () => {
		const a = gleicheAb({
			buchungen: [
				{ datum: '2026-10-02', betragCent: 500000, text: 'Umbuchung Tagesgeld', kategorie: null },
				{ datum: '2026-10-05', betragCent: 345000, text: 'Arbeitgeber', kategorie: 'gehalt' }
			],
			nettoCent: 345000,
			dauerauftraege: auftraege,
			gehaltKategorie: 'gehalt'
		});
		expect(a.gehalt?.text).toBe('Arbeitgeber');
	});

	it('mit Gehaltskategorie ohne passende Buchung ist kein Gehalt da', () => {
		const a = gleicheAb({
			buchungen: [{ datum: '2026-10-02', betragCent: 500000, text: 'Umbuchung', kategorie: null }],
			nettoCent: 345000,
			dauerauftraege: auftraege,
			gehaltKategorie: 'gehalt'
		});
		expect(a.gehalt).toBeNull();
		expect(a.ausstehendCent).toBe(0);
	});

	it('erkennt Daueraufträge am Terminplan, auch bei anderem Betrag', () => {
		const a = gleicheAb({
			buchungen: [
				gehalt,
				{ datum: '2026-10-07', betragCent: -120000, text: 'Spaß', terminplan: 'tp-spass' }
			],
			nettoCent: 345000,
			dauerauftraege: auftraege,
			terminplaene: new Map([['Spaßkonto', 'tp-spass']])
		});
		expect(a.auftraege.find((x) => x.name === 'Spaßkonto')?.gebucht?.text).toBe('Spaß');
		expect(a.ausstehendCent).toBe(69000 + 69600);
	});
});

