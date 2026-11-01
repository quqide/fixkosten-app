import { describe, expect, it } from 'vitest';
import { ausEntwurf, klartext, zuEntwurf } from './auftragEntwurf';

describe('Daueraufträge im Klartext', () => {
	it('Formel, Ziel und Rundung in einem Satz', () => {
		expect(klartext({ name: 'ETF', zielkonto: 'Depot', bausteine: [{ typ: 'prozent', prozent: 20 }] })).toBe('20 % vom Netto aufs Depot');
		expect(
			klartext({ name: 'Rücklagen', zielkonto: 'Tagesgeld', bausteine: [{ typ: 'fest', betragCent: 5000 }, { typ: 'ruecklagen', ziel: 'Tagesgeld' }], rundung: { schritt: 1000, richtung: 'auf' } })
		).toBe('50,00 € fest + Rücklagen mit Ziel Tagesgeld aufs Tagesgeld, auf 10 € aufgerundet');
		expect(klartext({ name: 'Gemeinsam', zielkonto: '', bausteine: [{ typ: 'gemeinschaft' }] })).toBe('dein Anteil am Gemeinschaftskonto');
	});

	it('Entwurf hin und zurück ergibt denselben Auftrag', () => {
		const a = { name: 'ETF', zielkonto: 'Depot', bausteine: [{ typ: 'prozent' as const, prozent: 12.5 }, { typ: 'fest' as const, betragCent: 1050 }], rundung: { schritt: 100, richtung: 'kaufm' as const } };
		expect(zuEntwurf(a).bausteine).toEqual([{ typ: 'prozent', wert: '12,5' }, { typ: 'fest', wert: '10,50' }]);
		expect(ausEntwurf(zuEntwurf(a))).toEqual(a);
		// Rest ohne gespeicherte Rundung: wie die Rechnung auf 1 € abrunden.
		expect(zuEntwurf({ name: 'Spaß', zielkonto: '', bausteine: [{ typ: 'rest' }] }).rundung).toEqual({ schritt: 100, richtung: 'ab' });
	});
});
