import { describe, expect, it } from 'vitest';
import { berechneRueckstellung, type RueckstellungKonfig } from '#lib/rechnung/rueckstellung.ts';
import { artText, ringAnteil, zustand, type RuecklageMitStand } from './ruecklageAnzeige';

const konfig = (x: Partial<RueckstellungKonfig>): RueckstellungKonfig => ({
	name: 'R', art: 'fest', betragCent: 10000, zielCent: null, zielNettoFaktor: null, faellig: null, zielkonto: null, wkn: null, aktiv: true, ...x
});
function mitStand(x: Partial<RueckstellungKonfig>, standCent: number | null = null): RuecklageMitStand {
	const eintrag = { ...konfig(x), actualKategorie: null, standCent };
	return { eintrag, ...berechneRueckstellung(eintrag, { standCent, nettoCent: 345000, stichtag: '2026-11-02', ueberweisungstag: 7 }) };
}

describe('Rücklagen im Klartext', () => {
	it('Art, Ziel und Fälligkeit wie im Entwurf', () => {
		expect(artText(mitStand({ art: 'fest', zielkonto: 'Tagesgeld' }))).toBe('fester Betrag aufs Tagesgeld');
		expect(artText(mitStand({ art: 'fest', wkn: 'A0RPWH' }))).toBe('fester Betrag in A0RPWH');
		expect(artText(mitStand({ art: 'ziel', betragCent: 20000, zielNettoFaktor: 3 }, 630000))).toBe('6.300 € von 10.350 € (3 × Netto)');
		expect(artText(mitStand({ art: 'faellig', zielCent: 1200000, faellig: '2029-03-31' }))).toBe('Ziel 12.000 €, bis 03/2029');
	});

	it('Zustand und Ring folgen berechneRueckstellung', () => {
		const erreicht = mitStand({ art: 'ziel', betragCent: 20000, zielCent: 500000 }, 500000);
		const laufend = mitStand({ art: 'ziel', betragCent: 20000, zielCent: 500000 }, 125000);
		const pausiert = mitStand({ art: 'ziel', betragCent: 20000, zielCent: 500000, aktiv: false }, 250000);
		const fest = mitStand({ art: 'fest' });
		expect([erreicht, laufend, pausiert, fest].map(zustand)).toEqual(['erreicht', 'läuft', 'pausiert', 'läuft']);
		expect([erreicht, laufend, pausiert, fest].map(ringAnteil)).toEqual([1, 0.25, 0.5, 0]);
		expect(erreicht.rateCent).toBe(0);
		expect(laufend.rateCent).toBe(20000);
	});
});
