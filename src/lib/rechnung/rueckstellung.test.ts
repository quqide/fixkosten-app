import { describe, expect, it } from 'vitest';
import { berechneRueckstellung, ratenBis, zielVon, type RueckstellungKonfig } from './rueckstellung';

const basis: RueckstellungKonfig = {
	name: 'Test',
	art: 'fest',
	betragCent: 5000,
	zielCent: null,
	zielNettoFaktor: null,
	faellig: null,
	zielkonto: 'Tagesgeld',
	wkn: null,
	aktiv: true
};
const e = { standCent: null, nettoCent: 300000, stichtag: '2026-10-29', ueberweisungstag: 7 };

describe('ratenBis', () => {
	it('zählt Termine ab dem nächsten Überweisungstag', () => {
		expect(ratenBis('2026-10-29', '2027-03-31', 7)).toBe(5); // Nov–März
		expect(ratenBis('2026-10-05', '2027-03-31', 7)).toBe(6); // Okt–März
		expect(ratenBis('2026-10-07', '2026-10-07', 7)).toBe(1);
		expect(ratenBis('2026-10-29', '2026-11-06', 7)).toBe(0);
	});
	it('kommt mit Monatsende klar', () => {
		expect(ratenBis('2026-01-31', '2026-04-30', 31)).toBe(4); // 31.1., 28.2., 31.3., 30.4.
	});
});

describe('berechneRueckstellung', () => {
	it('fest und pausiert', () => {
		expect(berechneRueckstellung(basis, e)).toMatchObject({ rateCent: 5000, status: 'aktiv' });
		expect(berechneRueckstellung({ ...basis, aktiv: false }, e)).toMatchObject({ rateCent: 0, status: 'pausiert' });
	});
	it('Notgroschen: 3 × Netto, pausiert sich, wenn voll', () => {
		const n = { ...basis, art: 'ziel' as const, betragCent: 20000, zielNettoFaktor: 3 };
		expect(berechneRueckstellung(n, { ...e, standCent: 100000 })).toMatchObject({ rateCent: 20000, zielCent: 900000 });
		expect(berechneRueckstellung(n, { ...e, standCent: 890050 })).toMatchObject({ rateCent: 10000 });
		const voll = berechneRueckstellung(n, { ...e, standCent: 900000 });
		expect(voll).toMatchObject({ rateCent: 0, status: 'erreicht', fortschritt: 1 });
	});
	it('mit Fälligkeit: Rate aus Restbetrag und Raten', () => {
		const f = { ...basis, art: 'faellig' as const, zielCent: 120000, faellig: '2027-03-31' };
		// 5 Raten, 1.200 € offen → 240 €
		expect(berechneRueckstellung(f, e)).toMatchObject({ rateCent: 24000, restRaten: 5 });
		// 1.000 € gespart → 200 € offen → 40 €
		expect(berechneRueckstellung(f, { ...e, standCent: 100000 })).toMatchObject({ rateCent: 4000 });
		expect(berechneRueckstellung(f, { ...e, standCent: 120000 })).toMatchObject({ rateCent: 0, status: 'erreicht' });
		expect(berechneRueckstellung(f, { ...e, stichtag: '2027-04-01' })).toMatchObject({ rateCent: 0, status: 'faellig' });
	});
	it('WKN geht vor Konto', () => {
		expect(zielVon({ wkn: 'A0RPWH', zielkonto: 'Depot' })).toBe('A0RPWH');
		expect(zielVon({ wkn: '', zielkonto: 'Depot' })).toBe('Depot');
	});
});
