import { describe, expect, it } from 'vitest';
import { berechneAufstellung, type AufstellungEingaben } from './aufstellung';

const basis: AufstellungEingaben = {
	modus: 1,
	nettoCent: 345000,
	etfQuoteProzent: 20,
	rueckstellungen: [
		{ name: 'Urlaub', betragCent: 0, zielkonto: 'Tagesgeld' },
		{ name: 'Schlussrate Mazda 6e', betragCent: 20000, zielkonto: 'Tagesgeld' }
	],
	gemeinschaftCent: 73000,
	fixkostenMonatlichCent: 61130
};

describe('Monatsaufstellung', () => {
	it('Modus 1: Spaßkonto bekommt den abgerundeten Überschuss, Fixkosten bleiben auf dem Gehaltskonto', () => {
		const a = berechneAufstellung(basis);
		expect(a.etfCent).toBe(69000);
		// 3.450 − 690 − 200 − 730 − 611,30 = 1.218,70 → 1.218 €
		expect(a.spassCent).toBe(121800);
		expect(a.dauerauftraege.map((d) => d.name)).toEqual([
			'ETF-Sparplan',
			'Schlussrate Mazda 6e',
			'Gemeinschaftskonto',
			'Spaßkonto'
		]);
		expect(a.verbleibtAufGehaltskontoCent).toBe(61200);
		expect(a.verbleibtAufGehaltskontoCent).toBeGreaterThanOrEqual(basis.fixkostenMonatlichCent);
		expect(a.warnungen).toEqual([]);
	});

	it('Modus 2: Fixkosten-Konto bekommt die aufgerundete Rate, der Rest ist Spaß', () => {
		const a = berechneAufstellung({ ...basis, modus: 2 });
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
		const a = berechneAufstellung({ ...basis, nettoCent: 150000 });
		expect(a.spassCent).toBe(0);
		expect(a.warnungen).toHaveLength(1);
	});
});
