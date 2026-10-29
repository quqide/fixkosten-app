import { describe, expect, it } from 'vitest';
import { berechneGemeinschaft, type Gemeinschaftskonto } from './gemeinschaft';

const konto: Gemeinschaftskonto = {
	mieteCent: 45000,
	alltagCent: 65000,
	ruecklageCent: 10000,
	fixkosten: [
		{ name: 'Internet', intervallMonate: 1, betragCent: 3999, buchungsdatum: '2026-09-01' },
		{ name: 'Rundfunkbeitrag', intervallMonate: 3, betragCent: 5508, buchungsdatum: '2026-08-15' }
	],
	modell: 'A'
};
const personen: [{ name: string; nettoCent: number }, { name: string; nettoCent: number }] = [
	{ name: 'Stephan', nettoCent: 345000 },
	{ name: 'Partnerin', nettoCent: 250000 }
];

describe('Gemeinschaftskonto', () => {
	it('rechnet die gemeinsamen Fixkosten auf volle Euro um', () => {
		// 39,99 + 18,36 = 58,35 → 59 €
		const r = berechneGemeinschaft(konto, personen, '2026-09-28');
		expect(r.fixkostenCent).toBe(5900);
		expect(r.gesamtCent).toBe(45000 + 65000 + 10000 + 5900);
	});

	it('Modell A: teilt nach Netto und rundet beide Anteile auf', () => {
		const r = berechneGemeinschaft(konto, personen, '2026-09-28');
		// 1.259 € × 3450 / 5950 = 730,01 € → 731 €; Rest 528,99 € → 529 €
		expect(r.anteile[0].gehaltsanteil).toBeCloseTo(0.5798, 4);
		expect(r.anteile.map((a) => a.betragCent)).toEqual([73100, 52900]);
		expect(r.anteile[0].betragCent + r.anteile[1].betragCent).toBeGreaterThanOrEqual(r.gesamtCent);
	});

	it('Modell A: Rundung geht für beide nach oben', () => {
		const r = berechneGemeinschaft({ ...konto, alltagCent: 65010 }, personen, '2026-09-28');
		// 1.259,10 € → 730,06 € und 529,04 €
		expect(r.anteile.map((a) => a.betragCent)).toEqual([73100, 53000]);
	});

	it('Modell B: beiden bleibt gleich viel übrig', () => {
		const r = berechneGemeinschaft({ ...konto, modell: 'B' }, personen, '2026-09-28');
		const [a, b] = r.anteile;
		// (1.259 + 3.450 − 2.500) / 2 = 1.104,50 € → 1.105 €; Rest 154,50 € → 155 €
		expect([a.betragCent, b.betragCent]).toEqual([110500, 15500]);
		expect(personen[0].nettoCent - a.betragCent).toBe(personen[1].nettoCent - b.betragCent);
	});

	it('Modell B: niemand überweist mehr als die Gesamtsumme', () => {
		const r = berechneGemeinschaft({ ...konto, modell: 'B' }, [
			{ name: 'Viel', nettoCent: 1000000 },
			{ name: 'Wenig', nettoCent: 100000 }
		], '2026-09-28');
		expect(r.anteile.map((a) => a.betragCent)).toEqual([r.gesamtCent, 0]);
	});
});
