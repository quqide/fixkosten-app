import { describe, expect, it } from 'vitest';
import type { FixkostenPosten } from './fixkosten';
import { grosseAbbuchungen } from './verlauf';

const posten = (x: Partial<FixkostenPosten>): FixkostenPosten => ({ name: 'Posten', intervallMonate: 12, betragCent: 10000, buchungsdatum: '2026-03-15', ...x });

describe('Größere Abbuchungen der nächsten zwölf Monate', () => {
	it('jährlich genau einmal im März, vierteljährlich viermal, monatlich nie', () => {
		const m = grosseAbbuchungen(
			[
				posten({ name: 'Kfz-Versicherung', betragCent: 64000, buchungsdatum: '2025-03-15' }),
				posten({ name: 'Wasser', intervallMonate: 3, betragCent: 9000, buchungsdatum: '2026-01-20' }),
				posten({ name: 'Netflix', intervallMonate: 1, betragCent: 1299, buchungsdatum: '2026-10-05' })
			],
			'2026-11-01'
		);
		const termine = m.flatMap((x) => x.abbuchungen);
		expect(termine.filter((a) => a.name === 'Kfz-Versicherung').map((a) => a.datum)).toEqual(['2027-03-15']);
		expect(termine.filter((a) => a.name === 'Wasser').map((a) => a.datum)).toEqual(['2027-01-20', '2027-04-20', '2027-07-20', '2027-10-20']);
		expect(termine.some((a) => a.name === 'Netflix')).toBe(false);
		// Nach Monat gruppiert, mit Monatssumme; Monate ohne Abbuchung fehlen.
		expect(m.map((x) => [x.monat, x.summeCent])).toEqual([
			['2027-01', 9000],
			['2027-03', 64000],
			['2027-04', 9000],
			['2027-07', 9000],
			['2027-10', 9000]
		]);
	});

	it('mehrere Posten im selben Monat stehen zusammen, nach Datum', () => {
		const m = grosseAbbuchungen(
			[posten({ name: 'Rundfunk', betragCent: 5500, buchungsdatum: '2026-03-20' }), posten({ name: 'Kfz-Versicherung', betragCent: 64000 })],
			'2026-11-01'
		);
		expect(m).toEqual([
			{
				monat: '2027-03',
				abbuchungen: [
					{ name: 'Kfz-Versicherung', datum: '2027-03-15', betragCent: 64000 },
					{ name: 'Rundfunk', datum: '2027-03-20', betragCent: 5500 }
				],
				summeCent: 69500
			}
		]);
	});

	it('mit Beteiligung zählt der eigene Anteil', () => {
		const m = grosseAbbuchungen([posten({ name: 'Hausrat', betragCent: 20000, beteiligungen: [{ name: 'Partner', betragCent: 10000 }] })], '2026-11-01');
		expect(m[0].abbuchungen).toEqual([{ name: 'Hausrat', datum: '2027-03-15', betragCent: 10000 }]);
	});

	it('Abbuchung am Stichtag zählt mit, ein Jahr später nicht mehr', () => {
		const termine = grosseAbbuchungen([posten({ buchungsdatum: '2025-11-01' })], '2026-11-01').flatMap((x) => x.abbuchungen.map((a) => a.datum));
		expect(termine).toEqual(['2026-11-01']);
	});

	it('Monatsende bleibt am Monatsende (31. → 28.02. → 31.05.)', () => {
		const termine = grosseAbbuchungen([posten({ intervallMonate: 3, buchungsdatum: '2026-08-31' })], '2026-11-01').flatMap((x) =>
			x.abbuchungen.map((a) => a.datum)
		);
		expect(termine).toEqual(['2026-11-30', '2027-02-28', '2027-05-31', '2027-08-31']);
	});

	it('ohne Posten mit Intervall über einem Monat: leere Liste; ohne Datum oder Eingänge zählen nicht', () => {
		expect(grosseAbbuchungen([posten({ intervallMonate: 1 })], '2026-11-01')).toEqual([]);
		expect(grosseAbbuchungen([posten({ buchungsdatum: null }), posten({ betragCent: -5000 })], '2026-11-01')).toEqual([]);
	});
});
