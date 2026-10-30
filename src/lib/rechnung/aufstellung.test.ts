import { describe, expect, it } from 'vitest';
import { berechneAufstellung, standardAuftraege, type AufstellungEingaben, type Kontenmodus } from './aufstellung';

const rueckstellungen = [
	{ name: 'Urlaub', betragCent: 0, zielkonto: 'Tagesgeld' },
	{ name: 'Schlussrate Mazda 6e', betragCent: 20000, zielkonto: 'Tagesgeld' }
];
const eingaben = (modus: Kontenmodus = 1, nettoCent = 345000): AufstellungEingaben => ({
	modus,
	nettoCent,
	auftraege: standardAuftraege(modus, 20, rueckstellungen),
	rueckstellungen,
	gemeinschaftCent: 73000,
	fixkostenMonatlichCent: 61130
});
const basis = eingaben();

describe('Monatsaufstellung', () => {
	it('warnt, wenn in Modus 1 eine Fixkosten-Rate überwiesen wird', () => {
		const e = { ...basis, auftraege: [{ name: 'Fixkosten', zielkonto: 'Fixkosten-Konto', bausteine: [{ typ: 'fixkosten' as const }] }, ...basis.auftraege] };
		expect(berechneAufstellung(e).warnungen.some((w) => w.includes('doppelt'))).toBe(true);
	});

	it('Modus 1: Spaßkonto bekommt den abgerundeten Überschuss, Fixkosten bleiben auf dem Gehaltskonto', () => {
		const a = berechneAufstellung(basis);
		expect(a.dauerauftraege[0]).toEqual({ name: 'ETF-Sparplan', zielkonto: 'Depot', betragCent: 69000 });
		// 3.450 − 690 − 200 − 730 − 611,30 = 1.218,70 → 1.218 €
		expect(a.spassCent).toBe(121800);
		// Pausierte Rückstellungen (Rate 0) zählen beim Ziel mit, damit der Auftrag bleibt, wenn sie wieder laufen.
		expect(a.dauerauftraege.map((d) => d.name)).toEqual([
			'ETF-Sparplan',
			'Rücklagen Tagesgeld',
			'Gemeinschaftskonto',
			'Spaßkonto'
		]);
		expect(a.verbleibtAufGehaltskontoCent).toBe(61200);
		expect(a.verbleibtAufGehaltskontoCent).toBeGreaterThanOrEqual(basis.fixkostenMonatlichCent);
		expect(a.warnungen).toEqual([]);
	});

	it('Modus 2: Fixkosten-Konto bekommt die aufgerundete Rate, der Rest ist Spaß', () => {
		const a = berechneAufstellung(eingaben(2));
		expect(a.dauerauftraege[0]).toEqual({
			name: 'Fixkosten',
			zielkonto: 'Fixkosten-Konto',
			betragCent: 61200
		});
		expect(a.spassCent).toBe(121800);
		const summe = a.dauerauftraege.reduce((s, d) => s + d.betragCent, 0) + a.spassCent;
		expect(summe).toBe(basis.nettoCent);
	});

	it('warnt, wenn das Netto nicht reicht', () => {
		const a = berechneAufstellung(eingaben(1, 150000));
		expect(a.spassCent).toBe(0);
		expect(a.warnungen).toHaveLength(1);
	});

	it('eigene Daueraufträge: Bausteine summieren, Rundung pro Auftrag', () => {
		const a = berechneAufstellung({
			...basis,
			nettoCent: 347500,
			auftraege: [
				{ name: 'ETF Invest', zielkonto: 'Depot', bausteine: [{ typ: 'prozent', prozent: 20 }], rundung: { schritt: 1000, richtung: 'auf' } },
				{ name: 'ETF Rückstellungen', zielkonto: 'Tagesgeld', bausteine: [{ typ: 'ruecklagen', ziel: 'Tagesgeld' }, { typ: 'fest', betragCent: 5000 }] },
				{ name: 'Gemeinschaft', zielkonto: 'Gemeinschaftskonto', bausteine: [{ typ: 'gemeinschaft' }] },
				{ name: 'Spaß', zielkonto: 'Spaßkonto', bausteine: [{ typ: 'rest' }] }
			]
		});
		// 20 % von 3.475 € = 695 € → auf 10 € aufgerundet 700 €
		expect(a.dauerauftraege.map((d) => d.betragCent)).toEqual([70000, 25000, 73000, 118300]);
		// Rest: 3.475 − 700 − 250 − 730 − 611,30 = 1.183,70 → 1.183 €
		expect(a.warnungen).toEqual([]);
	});

	it('warnt bei Rücklagen ohne Dauerauftrag und fehlender Fixkosten-Rate in Modus 2', () => {
		const a = berechneAufstellung({
			...eingaben(2),
			auftraege: [{ name: 'ETF', zielkonto: 'Depot', bausteine: [{ typ: 'prozent', prozent: 20 }] }]
		});
		expect(a.warnungen).toEqual([
			'Im Modell „Eigenes Fixkosten-Konto“ fehlt der Dauerauftrag mit der Fixkosten-Rate.',
			'Die Rücklage „Schlussrate Mazda 6e“ (Ziel Tagesgeld) überweist kein Dauerauftrag.'
		]);
	});
});
