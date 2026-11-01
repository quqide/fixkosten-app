import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { berechnePersonAnsicht, type PersonAnsichtEingaben, type RueckstellungEingabe } from './ansicht';
import { berechneAufstellung, standardAuftraege, type Kontenmodus } from './aufstellung';
import type { RueckstellungKonfig } from './rueckstellung';

const stichtag = '2026-10-30';

const rueckstellung = (name: string, betragCent: number, aktiv: boolean): RueckstellungEingabe => ({
	eintrag: {
		name, art: 'fest', betragCent, zielCent: null, zielNettoFaktor: null, faellig: null,
		zielkonto: 'Tagesgeld', wkn: null, aktiv
	} satisfies RueckstellungKonfig,
	standCent: null,
	standQuelle: null,
	hinweis: null
});

/**
 * Dieselben Zahlen wie in den Akzeptanztests der Monatsaufstellung (aufstellung.test.ts):
 * 3.450 € Netto, Rücklagen 0 € (pausiert) und 200 €, 730 € Gemeinschaft, 611,30 € Fixkosten im Monat.
 */
function eingaben(modus: Kontenmodus): PersonAnsichtEingaben {
	return {
		id: 'a',
		person: {
			nettoCent: 345000, ueberweisungstag: 7, modus, pufferCent: 2500,
			istCent: null, istAusstehend: false, istQuelle: 'hand', abgleich: null
		},
		posten: [{ name: 'Fixkosten', intervallMonate: 1, betragCent: 61130, buchungsdatum: '2026-10-01' }],
		rueckstellungen: [rueckstellung('Urlaub', 15000, false), rueckstellung('Schlussrate Mazda 6e', 20000, true)],
		// 1.460 € auf zwei gleiche Gehälter: je 730 €.
		gemeinschaft: {
			konto: { positionen: [{ name: 'Miete', art: 'fest', betragCent: 146000 }], modell: 'A', rundung: null },
			posten: [],
			personen: [
				{ name: 'A', nettoCent: 345000 },
				{ name: 'B', nettoCent: 345000 }
			]
		},
		auftraege: standardAuftraege(modus, 20, [
			{ name: 'Urlaub', betragCent: 0, zielkonto: 'Tagesgeld' },
			{ name: 'Schlussrate Mazda 6e', betragCent: 20000, zielkonto: 'Tagesgeld' }
		])
	};
}

describe('Rechenfunktion der Personenansicht', () => {
	it('Modus 1: dieselbe Monatsaufstellung wie die Akzeptanztests', () => {
		const e = eingaben(1);
		const a = berechnePersonAnsicht(e, stichtag);
		expect(a.gemeinschaft.anteil.a.betragCent).toBe(73000);
		expect(a.fixkosten.summeMonatlichCent).toBe(61130);
		expect(a.rueckstellungen.map((r) => r.rateCent)).toEqual([0, 20000]);
		expect(a.aufstellung.dauerauftraege[0]).toEqual({ name: 'ETF-Sparplan', zielkonto: 'Depot', betragCent: 69000 });
		expect(a.aufstellung.spassCent).toBe(121800);
		expect(a.aufstellung.dauerauftraege.map((d) => d.name)).toEqual(['ETF-Sparplan', 'Rücklagen Tagesgeld', 'Gemeinschaftskonto', 'Spaßkonto']);
		expect(a.aufstellung.verbleibtAufGehaltskontoCent).toBe(61200);
		expect(a.aufstellung.warnungen).toEqual([]);
		// Genau das, was berechneAufstellung mit den Zahlen aus aufstellung.test.ts liefert.
		expect(a.aufstellung).toEqual(
			berechneAufstellung({
				modus: 1,
				nettoCent: 345000,
				auftraege: e.auftraege,
				rueckstellungen: [
					{ name: 'Urlaub', betragCent: 0, zielkonto: 'Tagesgeld' },
					{ name: 'Schlussrate Mazda 6e', betragCent: 20000, zielkonto: 'Tagesgeld' }
				],
				gemeinschaftCent: 73000,
				fixkostenMonatlichCent: 61130
			})
		);
	});

	it('Modus 2: Fixkosten-Konto bekommt die aufgerundete Rate, der Rest ist Spaß', () => {
		const a = berechnePersonAnsicht(eingaben(2), stichtag);
		expect(a.aufstellung.dauerauftraege[0]).toEqual({ name: 'Fixkosten', zielkonto: 'Fixkosten-Konto', betragCent: 61200 });
		expect(a.aufstellung.spassCent).toBe(121800);
		expect(a.aufstellung.dauerauftraege.reduce((s, d) => s + d.betragCent, 0) + a.aufstellung.spassCent).toBe(345000);
	});

	it('vergleicht den Kontostand und zieht offene Daueraufträge ab', () => {
		const e = eingaben(1);
		const a = berechnePersonAnsicht({ ...e, person: { ...e.person, istCent: 400000, istAusstehend: true } }, stichtag);
		// ETF 690 + Rücklagen 200 + Gemeinschaft 730 + Spaß 1.218 €
		expect(a.ausstehendCent).toBe(283800);
		expect(a.vergleich?.istBereinigtCent).toBe(400000 - a.ausstehendCent);
	});

	it('greift nicht auf die Datenbank zu: kein Import aus src/lib/server', () => {
		const quelle = readFileSync(new URL('./ansicht.ts', import.meta.url), 'utf8');
		const importe = [...quelle.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
		expect(importe.length).toBeGreaterThan(0);
		expect(importe.filter((i) => i.includes('server') || i.startsWith('$'))).toEqual([]);
	});
});
