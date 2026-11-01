import { readdirSync, readFileSync } from 'node:fs';
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

	it('warnt bei Rücklagen, deren Stand aus Actual fehlt', () => {
		const e = eingaben(1);
		const ohneStand = (name: string, art: 'faellig' | 'ziel'): RueckstellungEingabe => ({
			eintrag: {
				name, art, betragCent: 5000, zielCent: 100000, zielNettoFaktor: null, faellig: art === 'faellig' ? '2027-09-30' : null,
				zielkonto: 'Tagesgeld', wkn: null, aktiv: true
			},
			standCent: null,
			standQuelle: null,
			hinweis: 'Kategorie in Actual nicht gefunden.'
		});
		const a = berechnePersonAnsicht({ ...e, rueckstellungen: [ohneStand('Auto', 'faellig'), ohneStand('Notgroschen', 'ziel')] }, stichtag);
		expect(a.rueckstellungen.map((r) => [r.status, r.rateCent])).toEqual([
			['unbekannt', 0],
			['unbekannt', 5000]
		]);
		expect(a.aufstellung.warnungen).toEqual([
			'Rücklage „Auto“: Kategorie in Actual nicht gefunden. Ohne Stand ist keine Rate eingeplant.',
			'Rücklage „Notgroschen“: Kategorie in Actual nicht gefunden. Die Rate ist nicht am Ziel gekappt.'
		]);
	});

	it('greift nicht auf die Datenbank zu: kein Modul in src/lib/rechnung importiert aus src/lib/server', () => {
		const ordner = new URL('./', import.meta.url);
		const dateien = readdirSync(ordner).filter((d) => d.endsWith('.ts') && !d.endsWith('.test.ts'));
		expect(dateien).toContain('ansicht.ts');
		for (const datei of dateien) {
			const quelle = readFileSync(new URL(datei, ordner), 'utf8');
			// Statische Importe, Re-Exporte und dynamische import().
			const ziele = [...quelle.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);
			expect(ziele.filter((z) => z.includes('server') || z.startsWith('$')), datei).toEqual([]);
		}
	});
});
