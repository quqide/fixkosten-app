import { describe, expect, it } from 'vitest';
import { berechnePersonAnsicht, type PersonAnsichtEingaben } from './ansicht';
import { standardAuftraege } from './aufstellung';
import { leseAenderung, mitAenderung, vergleicheAnsichten, type Aenderung } from './rechner';

const stichtag = '2026-10-30';
const keine = (): Aenderung => ({ positionen: new Map(), ohne: new Set(), neu: [] });

/** 3.450 € Netto bei beiden, Miete 1.460 €, gemeinsame Fixkosten 40 € (Internet), Modell A. */
function eingaben(): PersonAnsichtEingaben<
	PersonAnsichtEingaben['person'],
	PersonAnsichtEingaben['posten'][number] & { id?: number },
	PersonAnsichtEingaben['rueckstellungen'][number]['eintrag'],
	PersonAnsichtEingaben['gemeinschaft']['konto'] & { positionen: { id?: number; name: string; art: 'fest' | 'fixkosten'; betragCent: number }[] }
> {
	return {
		id: 'a',
		person: {
			nettoCent: 345000, ueberweisungstag: 7, modus: 1, pufferCent: 2500,
			istCent: null, istAusstehend: false, istQuelle: 'hand', abgleich: null
		},
		posten: [
			{ id: 1, name: 'Fixkosten', intervallMonate: 1, betragCent: 61130, buchungsdatum: '2026-10-01' },
			{ id: 2, name: 'Fitness', intervallMonate: 1, betragCent: 3000, buchungsdatum: '2026-10-01' }
		],
		rueckstellungen: [
			{
				eintrag: {
					name: 'Notgroschen', art: 'ziel', betragCent: 20000, zielCent: null, zielNettoFaktor: 3, faellig: null,
					zielkonto: 'Tagesgeld', wkn: null, aktiv: true
				},
				// Ziel 3 × 3.450 € = 10.350 €; es fehlen noch 150 €.
				standCent: 1020000,
				standQuelle: 'hand',
				hinweis: null
			}
		],
		gemeinschaft: {
			konto: {
				positionen: [
					{ id: 10, name: 'Miete', art: 'fest', betragCent: 146000 },
					{ id: 11, name: 'Gemeinsame Fixkosten', art: 'fixkosten', betragCent: 0 }
				],
				modell: 'A',
				rundung: null
			},
			posten: [{ id: 3, name: 'Internet', intervallMonate: 1, betragCent: 4000, buchungsdatum: '2026-10-15' }],
			personen: [
				{ name: 'Stephan', nettoCent: 345000 },
				{ name: 'Partner', nettoCent: 345000 }
			]
		},
		auftraege: standardAuftraege(1, 20, [{ name: 'Notgroschen', betragCent: 20000, zielkonto: 'Tagesgeld' }])
	};
}

function vergleich(a: Aenderung) {
	const e = eingaben();
	const heute = berechnePersonAnsicht(e, stichtag);
	const mit = berechnePersonAnsicht(mitAenderung(e, a), stichtag);
	return { heute, mit, gruppen: vergleicheAnsichten(heute, mit, 'a', { ich: 'Stephan', andere: 'Partner' }) };
}
const zeileVon = (gruppen: ReturnType<typeof vergleich>['gruppen'], name: string) =>
	gruppen.flatMap((g) => g.zeilen).find((z) => z.name === name)!;

describe('Rechner: Änderungen anwenden', () => {
	it('ohne Änderung sind heute und mit Änderung gleich, alle Differenzen 0 €', () => {
		const { heute, mit, gruppen } = vergleich(keine());
		expect(mit).toEqual(heute);
		expect(gruppen.flatMap((g) => g.zeilen).every((z) => z.differenzCent === 0)).toBe(true);
		expect(gruppen.map((g) => g.titel)).toEqual(['Pro Monat', 'Gemeinschaftskonto', 'Daueraufträge', 'Rücklagen']);
	});

	it('Netto +200 € bei Modell A: beide Gemeinschaftsanteile, Spaß und Ziel-Rücklage ändern sich', () => {
		const { gruppen } = vergleich({ ...keine(), nettoCent: 365000 });
		// Gesamt 1.500 € (1.460 € Miete + 40 € Internet). Vorher je 750 €.
		// Nachher 1.500 × 3.650 / 7.100 = 771,13 € → 772 €; Partner 728,87 € → 729 € (beide auf volle Euro aufgerundet).
		expect(zeileVon(gruppen, 'Anteil Stephan')).toEqual({ name: 'Anteil Stephan', heuteCent: 75000, mitCent: 77200, differenzCent: 2200 });
		expect(zeileVon(gruppen, 'Anteil Partner')).toEqual({ name: 'Anteil Partner', heuteCent: 75000, mitCent: 72900, differenzCent: -2100 });
		// ETF 20 %: 690 € → 730 €.
		expect(zeileVon(gruppen, 'ETF-Sparplan').differenzCent).toBe(4000);
		// Ziel 3 × Netto steigt auf 10.950 €, es fehlen 750 €: die volle Rate von 200 € statt 150 €.
		expect(zeileVon(gruppen, 'Notgroschen')).toMatchObject({ heuteCent: 15000, mitCent: 20000 });
		// Spaß vorher: 3.450 − 690 − 150 − 750 − 641,30 = 1.218,70 → 1.218 €.
		// Nachher: 3.650 − 730 − 200 − 772 − 641,30 = 1.306,70 → 1.306 €.
		expect(zeileVon(gruppen, 'Spaßkonto')).toMatchObject({ heuteCent: 121800, mitCent: 130600, differenzCent: 8800 });
	});

	it('zusätzlicher gemeinsamer Posten 120 € jährlich: gemeinsame Fixkosten +10 € pro Monat', () => {
		const { gruppen } = vergleich({ ...keine(), neu: [{ name: 'Rundfunk', betragCent: 12000, intervallMonate: 12, gemeinsam: true }] });
		expect(zeileVon(gruppen, 'Gemeinsame Fixkosten')).toEqual({ name: 'Gemeinsame Fixkosten', heuteCent: 4000, mitCent: 5000, differenzCent: 1000 });
		expect(zeileVon(gruppen, 'Deine Fixkosten').differenzCent).toBe(0);
	});

	it('persönlicher Posten, weggelassene Posten und geänderte Miete', () => {
		const { gruppen } = vergleich({
			...keine(),
			neu: [{ name: 'Auto', betragCent: 30000, intervallMonate: 1, gemeinsam: false }],
			ohne: new Set([2, 3]),
			positionen: new Map([[10, 150000]])
		});
		// +300 € Auto, −30 € Fitness.
		expect(zeileVon(gruppen, 'Deine Fixkosten').differenzCent).toBe(27000);
		expect(zeileVon(gruppen, 'Gemeinsame Fixkosten').mitCent).toBe(0);
		// Gesamt 1.500 € (neue Miete, ohne Internet): je 750 €.
		expect(zeileVon(gruppen, 'Anteil Stephan').mitCent).toBe(75000);
	});

	it('lässt die ursprünglichen Eingaben unverändert', () => {
		const e = eingaben();
		const kopie = structuredClone(e);
		mitAenderung(e, { nettoCent: 1, nettoAndereCent: 2, positionen: new Map([[10, 3]]), ohne: new Set([1, 3]), neu: [{ name: 'X', betragCent: 1, intervallMonate: 1, gemeinsam: true }] });
		expect(e).toEqual(kopie);
	});
});

describe('Rechner: Parameter lesen', () => {
	const lies = (q: string) => leseAenderung(new URLSearchParams(q));

	it('liest Netto, Positionen, weggelassene und zusätzliche Posten', () => {
		const r = lies('netto=3.650&netto2=3200,50&pos_10=1500&ohne=2&ohne=3&n_name=Rundfunk&n_betrag=120&n_intervall=12&n_wer=gemeinsam&n_name=&n_betrag=&n_intervall=&n_wer=persoenlich');
		expect(r.fehler).toEqual({});
		expect(r.aenderung).toEqual({
			nettoCent: 365000,
			nettoAndereCent: 320050,
			positionen: new Map([[10, 150000]]),
			ohne: new Set([2, 3]),
			neu: [{ name: 'Rundfunk', betragCent: 12000, intervallMonate: 12, gemeinsam: true }]
		});
		// Die leere Zeile am Ende zählt nicht.
		expect(r.zeilen).toHaveLength(1);
	});

	it('ohne Parameter keine Änderung', () => {
		expect(lies('')).toEqual({ aenderung: keine(), zeilen: [], fehler: {} });
	});

	it('meldet ungültige Werte freundlich und übernimmt sie nicht', () => {
		const r = lies('netto=viel&netto2=-5&pos_10=abc&n_name=Auto&n_betrag=300&n_intervall=-3&n_wer=x&n_name=Boot&n_betrag=zwei&n_intervall=1');
		expect(r.aenderung).toEqual(keine());
		expect(Object.keys(r.fehler).sort()).toEqual(['n_0', 'n_1', 'netto', 'netto2', 'pos_10']);
		expect(r.fehler.netto).toMatch(/Bitte eine Zahl/);
		expect(r.fehler.netto2).toMatch(/nicht negativ/);
		expect(r.fehler.n_0).toBe('„Auto“: Das Intervall muss eine ganze Zahl von 1 bis 24 Monaten sein.');
		expect(r.fehler.n_1).toBe('„Boot“: Bitte einen Betrag über 0 eintragen.');
		// Die Zeilen bleiben im Formular stehen.
		expect(r.zeilen.map((z) => z.name)).toEqual(['Auto', 'Boot']);
	});

	it('leeres Intervall heißt monatlich', () => {
		expect(lies('n_name=Abo&n_betrag=9,99').aenderung.neu).toEqual([{ name: 'Abo', betragCent: 999, intervallMonate: 1, gemeinsam: false }]);
	});
});
