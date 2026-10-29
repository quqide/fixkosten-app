import { describe, expect, it } from 'vitest';
import { berechneFixkosten, type FixkostenPosten } from './fixkosten';
import { beispielFixkosten } from './beispieldaten';

const UEBERWEISUNGSTAG = 7;

/** Die Beispieldaten genau so, wie sie in der alten Tabelle standen: Beteiligungen als eigene Zeilen. */
const alteTabelle: FixkostenPosten[] = [
	['Miete', 1, 45000, '2026-09-15'],
	['Mazda 6e Tilgung', 1, 34400, '2026-10-01'],
	['Mazda 6e Versicherung', 12, 125292, '2026-10-01'],
	['iCloud', 1, 3495, '2026-09-08'],
	['Versicherung Suzuki', 1, 3481, '2026-09-15'],
	['Clever Fit', 1, 2990, '2026-09-01'],
	['Steuer Suzuki', 1, 2900, '2026-09-15'],
	['Telekom', 1, 2495, '2026-08-25'],
	['Adobe', 1, 1799, '2026-08-31'],
	['ADAC', 12, 18900, '2026-03-02'],
	['DAV Bad Tölz', 12, 7900, '2026-01-02'],
	['1Password', 12, 6783, '2025-11-19'],
	['Alpha Progression', 12, 5999, '2026-01-29'],
	['Loreen ADAC', 12, -5000, '2026-03-02'],
	['Loreen iCloud', 1, -585, '2026-09-08', 1],
	['Oliver iCloud', 1, -1170, '2026-09-08', 1],
	['Klaus iCloud + Netflix', 1, -2000, '2026-09-08', 28]
].map(([name, intervallMonate, betragCent, buchungsdatum, eingangstag]) => ({
	name: name as string,
	intervallMonate: intervallMonate as number,
	betragCent: betragCent as number,
	buchungsdatum: buchungsdatum as string,
	eingangstag: (eingangstag as number | undefined) ?? null
}));

const mitMiete: FixkostenPosten[] = [
	{ name: 'Miete', intervallMonate: 1, betragCent: 45000, buchungsdatum: '2026-09-15' },
	...beispielFixkosten
];

function rechne(posten: FixkostenPosten[], stichtag: string) {
	return berechneFixkosten(posten, { stichtag, ueberweisungstag: UEBERWEISUNGSTAG });
}

describe('Akzeptanztest Stichtag 28.09.2026', () => {
	// Name, monatlich, letzte Buchung, nächste Buchung, Raten, Soll
	const erwartet: [string, number, string, string, number, number][] = [
		['Miete', 45000, '2026-09-15', '2026-10-15', 0, 0],
		['Mazda 6e Tilgung', 34400, '2026-09-01', '2026-10-01', 1, 34400],
		['Mazda 6e Versicherung', 10441, '2025-10-01', '2026-10-01', 12, 125292],
		['iCloud', 3495, '2026-09-08', '2026-10-08', 0, 0],
		['Versicherung Suzuki', 3481, '2026-09-15', '2026-10-15', 0, 0],
		['Clever Fit', 2990, '2026-09-01', '2026-10-01', 1, 2990],
		['Steuer Suzuki', 2900, '2026-09-15', '2026-10-15', 0, 0],
		['Telekom', 2495, '2026-09-25', '2026-10-25', 0, 0],
		['Adobe', 1799, '2026-08-31', '2026-09-30', 1, 1799],
		['ADAC', 1575, '2026-03-02', '2027-03-02', 7, 11025],
		['DAV Bad Tölz', 659, '2026-01-02', '2027-01-02', 9, 5931],
		['1Password', 566, '2025-11-19', '2026-11-19', 10, 5660],
		['Alpha Progression', 500, '2026-01-29', '2027-01-29', 8, 4000],
		['Loreen ADAC', -416, '2026-03-02', '2027-03-02', 7, -2912],
		['Loreen iCloud', -585, '2026-09-08', '2026-10-08', 0, 0],
		['Oliver iCloud', -1170, '2026-09-08', '2026-10-08', 0, 0],
		['Klaus iCloud + Netflix', -2000, '2026-09-08', '2026-10-08', 0, 2000]
	];

	it('liefert alle Einzelwerte der alten Tabelle', () => {
		const ergebnis = rechne(alteTabelle, '2026-09-28');
		const ist = ergebnis.zeilen.map((z) => [
			z.name,
			z.monatlichCent,
			z.letzteBuchung,
			z.naechsteBuchung,
			z.ratenSeitBuchung,
			z.sollCent
		]);
		expect(ist).toEqual(erwartet);
	});

	it('liefert die Summen und die Überweisung', () => {
		const ergebnis = rechne(alteTabelle, '2026-09-28');
		expect(ergebnis.summeMonatlichCent).toBe(106130);
		expect(ergebnis.sollCent).toBe(190185);
		expect(ergebnis.ueberweisungCent).toBe(106200);
	});

	it('rechnet mit Beteiligungen am Posten genauso wie mit eigenen Zeilen', () => {
		const ergebnis = rechne(mitMiete, '2026-09-28');
		expect(ergebnis.summeMonatlichCent).toBe(106130);
		expect(ergebnis.sollCent).toBe(190185);
		const klaus = ergebnis.zeilen.find((z) => z.name === 'Klaus iCloud + Netflix');
		expect(klaus).toMatchObject({ gehoertZu: 'iCloud', monatlichCent: -2000, sollCent: 2000 });
	});
});

describe('Akzeptanztest weitere Stichtage', () => {
	const faelle: [string, number][] = [
		['2026-10-01', 27459],
		['2026-10-07', 133589],
		['2026-10-08', 130094],
		['2027-01-15', 103988]
	];
	for (const [stichtag, soll] of faelle) {
		it(`Soll gesamt am ${stichtag}`, () => {
			expect(rechne(alteTabelle, stichtag).sollCent).toBe(soll);
			expect(rechne(mitMiete, stichtag).sollCent).toBe(soll);
		});
	}
});

describe('Korrekturen gegenüber der alten Tabelle', () => {
	it('erkennt eine Abbuchung am Monatsende im kürzeren Monat (Adobe am 30.09.)', () => {
		const ergebnis = rechne(alteTabelle, '2026-09-30');
		const adobe = ergebnis.zeilen.find((z) => z.name === 'Adobe');
		expect(adobe).toMatchObject({
			letzteBuchung: '2026-09-30',
			naechsteBuchung: '2026-10-31',
			ratenSeitBuchung: 0,
			sollCent: 0
		});
		// Alte Tabelle: 1.901,85 €, also 17,99 € zu viel.
		expect(ergebnis.sollCent).toBe(188386);
	});

	it('nimmt nach dem 30.09. wieder den 31. als Abbuchungstag', () => {
		const adobe = rechne(alteTabelle, '2026-10-31').zeilen.find((z) => z.name === 'Adobe');
		expect(adobe?.letzteBuchung).toBe('2026-10-31');
	});
});

describe('Randfälle', () => {
	it('rechnet Posten mit Datum in der Zukunft rückwärts', () => {
		const [z] = rechne(
			[{ name: 'Jahresbeitrag', intervallMonate: 12, betragCent: 12000, buchungsdatum: '2027-03-15' }],
			'2026-09-28'
		).zeilen;
		expect(z.letzteBuchung).toBe('2026-03-15');
		expect(z.naechsteBuchung).toBe('2027-03-15');
		expect(z.ratenSeitBuchung).toBe(6);
		expect(z.sollCent).toBe(6000);
	});

	it('lässt Posten ohne Datum im Soll weg, rechnet sie aber monatlich mit', () => {
		const ergebnis = rechne(
			[{ name: 'Ohne Datum', intervallMonate: 3, betragCent: 1000 }],
			'2026-09-28'
		);
		expect(ergebnis.zeilen[0]).toMatchObject({ monatlichCent: 334, sollCent: 0, letzteBuchung: null });
	});

	it('lehnt ein Intervall von 0 ab', () => {
		expect(() =>
			rechne([{ name: 'Kaputt', intervallMonate: 0, betragCent: 100 }], '2026-09-28')
		).toThrow();
	});
});
