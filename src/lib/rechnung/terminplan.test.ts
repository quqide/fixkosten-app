import { describe, expect, it } from 'vitest';
import {
	alsPosten,
	pruefeTerminplaene,
	schlageRolleVor,
	type PruefungEingaben,
	type Rolle,
	type Terminplan
} from './terminplan';

const plan = (t: Partial<Terminplan> & { id: string }): Terminplan => ({
	name: t.id,
	kontoId: 'giro',
	kontoName: 'Gehaltskonto',
	empfaenger: t.id,
	umbuchung: false,
	betragCent: 1299,
	betragArt: 'fest',
	rhythmus: { frequenz: 'monthly', intervall: 1, muster: false },
	naechsterTermin: '2026-11-15',
	beendet: false,
	kategorieId: 'abos',
	letzteBuchung: null,
	...t
});

const basis = (terminplaene: Terminplan[], rollen: [string, Rolle][]): PruefungEingaben => ({
	terminplaene,
	zuordnung: new Map(rollen),
	kontoId: 'giro',
	kontoName: 'Gehaltskonto',
	dauerauftraege: [{ name: 'Spaßkonto', zielkonto: 'Spaßkonto', betragCent: 125200 }],
	gehaltKategorie: 'gehalt',
	letztesGehalt: '2026-10-05',
	verknuepft: [],
	heute: '2026-10-29'
});

const fix: Rolle = { typ: 'fixkosten' };
const texte = (e: PruefungEingaben) =>
	pruefeTerminplaene(e).map((w) => `${w.stufe}: ${w.text}`.replace(/\u00a0/g, ' '));

describe('Terminpläne übernehmen', () => {
	it('rechnet Rhythmus in Monate um', () => {
		expect(alsPosten(plan({ id: 'a', rhythmus: { frequenz: 'monthly', intervall: 3, muster: false } }))?.intervallMonate).toBe(3);
		expect(alsPosten(plan({ id: 'b', rhythmus: { frequenz: 'yearly', intervall: 1, muster: false } }))?.intervallMonate).toBe(12);
		expect(alsPosten(plan({ id: 'c', rhythmus: { frequenz: 'weekly', intervall: 1, muster: false } }))).toBeNull();
	});

	it('übernimmt Betrag und nächsten Termin als Buchungsdatum', () => {
		expect(alsPosten(plan({ id: 'Netflix' }))).toEqual({
			name: 'Netflix',
			intervallMonate: 1,
			betragCent: 1299,
			buchungsdatum: '2026-11-15'
		});
	});
});

describe('Prüfung der Einrichtung in Actual', () => {
	it('eine gute Einrichtung erzeugt keine Warnung', () => {
		expect(texte(basis([plan({ id: 'Netflix' })], [['Netflix', fix]]))).toEqual([]);
	});

	it('meldet fehlende Kategorie, falsches Konto, ungefähren Betrag und Wochenrhythmus', () => {
		const t = texte(
			basis(
				[
					plan({ id: 'ohneKat', kategorieId: null }),
					plan({ id: 'kredit', kontoId: 'kk', kontoName: 'Kreditkarte' }),
					plan({ id: 'strom', betragArt: 'ungefaehr', betragCent: 8000 }),
					plan({ id: 'putzen', rhythmus: { frequenz: 'weekly', intervall: 1, muster: false } })
				],
				[
					['ohneKat', fix],
					['kredit', fix],
					['strom', fix],
					['putzen', fix]
				]
			)
		);
		expect(t).toContain('warnung: „ohneKat“ hat keine Kategorie.');
		expect(t).toContain('warnung: „kredit“ wird von Kreditkarte abgebucht, nicht von Gehaltskonto.');
		expect(t).toContain('hinweis: „strom“ hat keinen festen Betrag. Die App rechnet mit 80,00 €.');
		expect(t.some((x) => x.startsWith('warnung: „putzen“ wiederholt sich nicht monatlich'))).toBe(true);
	});

	it('meldet Preisabweichung der letzten Buchung und überfällige Termine', () => {
		const t = texte(
			basis(
				[
					plan({ id: 'Spotify', letzteBuchung: { datum: '2026-10-15', betragCent: 1299 }, betragCent: 1099 }),
					plan({ id: 'GEZ', naechsterTermin: '2026-10-15' })
				],
				[
					['Spotify', fix],
					['GEZ', fix]
				]
			)
		);
		expect(t).toContain('warnung: „Spotify“: Zuletzt wurden 12,99 € abgebucht, geplant sind 10,99 €.');
		expect(t).toContain('warnung: „GEZ“ war am 15.10.2026 fällig, Actual hat aber keine Buchung dazu.');
	});

	it('fester Betrag: schon 1 € Preiserhöhung fällt auf, „ungefähr“ hat Spielraum', () => {
		const t = texte(
			basis(
				[
					plan({ id: 'Netflix', letzteBuchung: { datum: '2026-10-15', betragCent: 1399 } }),
					plan({ id: 'Strom', betragArt: 'ungefaehr', betragCent: 8000, letzteBuchung: { datum: '2026-10-15', betragCent: 8400 } })
				],
				[
					['Netflix', fix],
					['Strom', fix]
				]
			)
		);
		expect(t).toContain('warnung: „Netflix“: Zuletzt wurden 13,99 € abgebucht, geplant sind 12,99 €.');
		expect(t.filter((x) => x.includes('Strom') && x.includes('Zuletzt'))).toEqual([]);
	});

	it('meldet Dauerauftrag mit anderem Betrag als berechnet', () => {
		const t = texte(
			basis([plan({ id: 'spass', umbuchung: true, betragCent: 124000 })], [['spass', { typ: 'dauerauftrag', name: 'Spaßkonto' }]])
		);
		expect(t).toEqual(['warnung: Spaßkonto: In Actual stehen 1.240,00 €, berechnet sind 1.252,00 €.']);
	});

	it('meldet neue, beendete, doppelte und verschwundene Terminpläne', () => {
		const e = basis(
			[
				plan({ id: 'neu' }),
				plan({ id: 'alt', beendet: true }),
				plan({ id: 'netflix1', empfaenger: 'Netflix' }),
				plan({ id: 'netflix2', empfaenger: 'Netflix' })
			],
			[
				['alt', fix],
				['netflix1', fix],
				['netflix2', fix]
			]
		);
		e.verknuepft = [{ name: 'Zeitung', terminplanId: 'weg' }];
		const t = texte(e);
		expect(t).toContain('hinweis: Ein Terminplan ist noch keiner Rolle zugeordnet.');
		expect(t).toContain('hinweis: „alt“ ist in Actual beendet.');
		expect(t).toContain('hinweis: „netflix2“ und „netflix1“ sehen gleich aus.');
		expect(t).toContain('hinweis: Den Terminplan zu „Zeitung“ gibt es in Actual nicht mehr.');
	});

	it('meldet fehlende oder leere Gehaltskategorie', () => {
		const ohne = basis([], []);
		ohne.gehaltKategorie = null;
		expect(texte(ohne)[0]).toMatch(/keine Gehaltskategorie/);
		const leer = basis([], []);
		leer.letztesGehalt = '2026-09-05';
		expect(texte(leer)[0]).toMatch(/seit über einem Monat/);
	});
});

describe('Aufteilung des Gemeinschafts-Dauerauftrags', () => {
	const soll = {
		auftrag: 'Gemeinschaftskonto',
		teile: [
			{ name: 'Miete', kategorieId: 'miete', betragCent: 26128 },
			{ name: 'Alltag', kategorieId: 'alltag', betragCent: 37740 },
			{ name: 'Rücklage', kategorieId: null, betragCent: 5806 }
		]
	};
	const rolle: Rolle = { typ: 'dauerauftrag', name: 'Gemeinschaftskonto' };
	const mit = (aufteilung: Terminplan['aufteilung']) => {
		const e = basis([plan({ id: 'gem', betragCent: 69674, aufteilung })], [['gem', rolle]]);
		e.dauerauftraege = [{ name: 'Gemeinschaftskonto', zielkonto: '', betragCent: 69674 }];
		e.gemeinschaft = soll;
		e.kategorieName = (id) => ({ miete: 'Miete', alltag: 'Lebensmittel', urlaub: 'Urlaub' })[id] ?? id;
		return texte(e);
	};

	it('passende Aufteilung ergibt keine Warnung', () => {
		expect(mit([{ kategorieId: 'miete', betragCent: 26128 }, { kategorieId: 'alltag', betragCent: 37740 }])).toEqual([]);
	});

	it('meldet fehlende Aufteilung mit den Sollwerten', () => {
		const t = mit(null);
		expect(t).toHaveLength(1);
		expect(t[0]).toBe('hinweis: „gem“ ist nicht nach Kategorien aufgeteilt.');
	});

	it('meldet abweichende und fremde Teile', () => {
		const t = mit([
			{ kategorieId: 'miete', betragCent: 27000 },
			{ kategorieId: 'alltag', betragCent: 37740 },
			{ kategorieId: 'urlaub', betragCent: 1000 }
		]);
		expect(t).toContain('warnung: Gemeinschaftskonto/Miete: In Actual 270,00 €, berechnet 261,28 €.');
		expect(t).toContain('hinweis: „gem“ hat einen Teil für Urlaub, den keine Position des Gemeinschaftskontos nutzt.');
	});

	it('fasst Positionen mit derselben Kategorie zusammen', () => {
		const e = basis([plan({ id: 'gem', betragCent: 69674, aufteilung: [{ kategorieId: 'wohnen', betragCent: 31934 }, { kategorieId: 'alltag', betragCent: 37740 }] })], [['gem', rolle]]);
		e.dauerauftraege = [{ name: 'Gemeinschaftskonto', zielkonto: '', betragCent: 69674 }];
		e.gemeinschaft = {
			auftrag: 'Gemeinschaftskonto',
			teile: [
				{ name: 'Miete', kategorieId: 'wohnen', betragCent: 26128 },
				{ name: 'Nebenkosten', kategorieId: 'wohnen', betragCent: 5806 },
				{ name: 'Alltag', kategorieId: 'alltag', betragCent: 37740 }
			]
		};
		expect(texte(e)).toEqual([]);
		e.gemeinschaft.teile[1].betragCent = 6000;
		expect(texte(e)).toEqual(['warnung: Gemeinschaftskonto/Miete + Nebenkosten: In Actual 319,34 €, berechnet 321,28 €.']);
	});
});

describe('Vorschlag für neue Terminpläne', () => {
	const auftraege = [
		{ name: 'Spaßkonto', zielkonto: 'Spaßkonto', betragCent: 125200 },
		{ name: 'Gemeinschaftskonto', zielkonto: 'Gemeinschaftskonto', betragCent: 69600 }
	];
	it('Umbuchung mit passendem Betrag wird Dauerauftrag', () => {
		expect(schlageRolleVor(plan({ id: 'x', umbuchung: true, betragCent: 125200 }), 'giro', auftraege)).toEqual({
			typ: 'dauerauftrag',
			name: 'Spaßkonto'
		});
	});
	it('Ausgabe in Höhe des Gemeinschaftsanteils wird Dauerauftrag Gemeinschaftskonto', () => {
		expect(schlageRolleVor(plan({ id: 'x', betragCent: 69600 }), 'giro', auftraege)).toEqual({
			typ: 'dauerauftrag',
			name: 'Gemeinschaftskonto'
		});
	});
	it('normale Ausgabe wird Fixkosten, fremdes Konto und Einnahmen werden ignoriert', () => {
		expect(schlageRolleVor(plan({ id: 'x' }), 'giro', auftraege)).toEqual({ typ: 'fixkosten' });
		expect(schlageRolleVor(plan({ id: 'x', kontoId: 'kk' }), 'giro', auftraege)).toEqual({ typ: 'ignorieren' });
		expect(schlageRolleVor(plan({ id: 'x', betragCent: -345000 }), 'giro', auftraege)).toEqual({ typ: 'ignorieren' });
	});
});
