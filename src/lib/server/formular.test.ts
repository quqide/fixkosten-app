import { describe, expect, it } from 'vitest';
import { leseAuftraege, pruefeAuftraege } from './formular';

describe('Daueraufträge prüfen', () => {
	it('lehnt doppelte Namen ab', () => {
		const e = leseAuftraege([
			{ name: 'Sparen', zielkonto: 'Tagesgeld', bausteine: [{ typ: 'fest', wert: '50' }] },
			{ name: 'sparen ', zielkonto: 'Depot', bausteine: [{ typ: 'fest', wert: '20' }] }
		]);
		expect(e).toEqual({ fehler: { allgemein: expect.stringContaining('doppelt') } });
	});

	it('liest das Formular in die gespeicherte Form', () => {
		expect(
			leseAuftraege([
				{ name: 'ETF', zielkonto: 'Depot', bausteine: [{ typ: 'prozent', wert: '12,5' }], rundung: { schritt: 1000, richtung: 'auf' } },
				{ name: 'Gold', zielkonto: 'Depot', bausteine: [{ typ: 'ruecklagen', wert: ' a0rpwh ' }] },
				{ name: 'Spaß', zielkonto: 'Spaßkonto', bausteine: [{ typ: 'rest', wert: '' }], rundung: { schritt: 1, richtung: 'ab' } }
			], ['A0RPWH'])
		).toEqual({
			auftraege: [
				{ name: 'ETF', zielkonto: 'Depot', bausteine: [{ typ: 'prozent', prozent: 12.5 }], rundung: { schritt: 1000, richtung: 'auf' } },
				{ name: 'Gold', zielkonto: 'Depot', bausteine: [{ typ: 'ruecklagen', ziel: 'A0RPWH' }], rundung: null },
				{ name: 'Spaß', zielkonto: 'Spaßkonto', bausteine: [{ typ: 'rest' }], rundung: { schritt: 1, richtung: 'ab' } }
			]
		});
	});

	it('lehnt unbekannte Bausteine und fehlende Felder ab', () => {
		expect(pruefeAuftraege([{ name: 'X', bausteine: [{ typ: 'zaubern' }] }])).toHaveProperty('fehler.a_0');
		expect(pruefeAuftraege([{ name: 'X', bausteine: [{ typ: 'fest' }] }])).toHaveProperty('fehler.a_0');
		expect(pruefeAuftraege([{ name: 'X', bausteine: [{ typ: 'prozent', prozent: 120 }] }])).toHaveProperty('fehler.a_0');
		expect(pruefeAuftraege([{ bausteine: [{ typ: 'rest' }] }])).toHaveProperty('fehler.a_0');
		expect(pruefeAuftraege({})).toHaveProperty('fehler.allgemein');
	});

	it('lässt Kontonamen als Ziel unverändert', () => {
		expect(pruefeAuftraege([{ name: 'R', bausteine: [{ typ: 'ruecklagen', ziel: 'Tagesgeld ' }] }])).toEqual({
			auftraege: [{ name: 'R', zielkonto: '', bausteine: [{ typ: 'ruecklagen', ziel: 'Tagesgeld' }], rundung: null }]
		});
	});

	it('schreibt nur WKNs von Rückstellungen in deren Schreibweise', () => {
		const ziel = (z: string, wkns: string[]) => (pruefeAuftraege([{ name: 'R', bausteine: [{ typ: 'ruecklagen', ziel: z }] }], wkns) as { auftraege: { bausteine: { ziel: string }[] }[] }).auftraege[0].bausteine[0].ziel;
		expect(ziel('a0rpwh', ['A0RPWH'])).toBe('A0RPWH');
		// Ein Konto, das zufällig wie eine WKN aussieht, bleibt unverändert.
		expect(ziel('konto1', [])).toBe('konto1');
	});

	it('meldet doppelte Namen und mehrere Rest-Aufträge zusammen', () => {
		const e = pruefeAuftraege([
			{ name: 'Spaß', bausteine: [{ typ: 'rest' }] },
			{ name: 'spaß', bausteine: [{ typ: 'rest' }] }
		]) as { fehler: { allgemein: string } };
		expect(e.fehler.allgemein).toMatch(/doppelt.*Nur ein Dauerauftrag/);
	});

	it('lehnt zu große Beträge und zu lange Namen ab', () => {
		expect(pruefeAuftraege([{ name: 'X', bausteine: [{ typ: 'fest', betragCent: 100_000_001 }] }])).toHaveProperty('fehler.a_0');
		expect(pruefeAuftraege([{ name: 'X'.repeat(101), bausteine: [{ typ: 'rest' }] }])).toHaveProperty('fehler.a_0');
		expect(pruefeAuftraege([{ name: 'X', zielkonto: 'Y'.repeat(101), bausteine: [{ typ: 'rest' }] }])).toHaveProperty('fehler.a_0');
	});
});
