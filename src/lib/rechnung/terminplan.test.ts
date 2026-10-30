import { describe, expect, it } from 'vitest';
import {
	alsPosten,
	hinweisSchluessel,
	leseHinweisSchluessel,
	mitMeldungen,
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

describe('Art und Terminplan jeder Meldung', () => {
	const artUndPlan = (e: PruefungEingaben) => pruefeTerminplaene(e).map((w) => [w.art, w.terminplanId]);

	it('Prüfungen je Terminplan', () => {
		const e = basis(
			[
				plan({ id: 'neu' }),
				plan({ id: 'alt', beendet: true }),
				plan({ id: 'woche', rhythmus: { frequenz: 'weekly', intervall: 1, muster: false } }),
				plan({ id: 'muster', rhythmus: { frequenz: 'monthly', intervall: 1, muster: true } }),
				plan({ id: 'ungefaehr', betragArt: 'ungefaehr' }),
				plan({ id: 'kredit', kontoId: 'kk', kontoName: 'Kreditkarte' }),
				plan({ id: 'faellig', naechsterTermin: '2026-10-15' }),
				plan({ id: 'ohneKat', kategorieId: null }),
				plan({ id: 'umbuchung', umbuchung: true }),
				plan({ id: 'teurer', letzteBuchung: { datum: '2026-10-15', betragCent: 1399 } }),
				plan({ id: 'weg', betragCent: 5000 }),
				plan({ id: 'spass', betragCent: 124000 })
			],
			[
				['alt', fix],
				['woche', fix],
				['muster', fix],
				['ungefaehr', fix],
				['kredit', fix],
				['faellig', fix],
				['ohneKat', fix],
				['umbuchung', fix],
				['teurer', fix],
				['weg', { typ: 'dauerauftrag', name: 'Gibt es nicht' }],
				['spass', { typ: 'dauerauftrag', name: 'Spaßkonto' }]
			]
		);
		const a = artUndPlan(e);
		expect(a).toContainEqual(['ohne-rolle', null]);
		expect(a).toContainEqual(['beendet', 'alt']);
		expect(a).toContainEqual(['rhythmus', 'woche']);
		expect(a).toContainEqual(['sonderregel-tag', 'muster']);
		expect(a).toContainEqual(['ungefaehr', 'ungefaehr']);
		expect(a).toContainEqual(['anderes-konto', 'kredit']);
		expect(a).toContainEqual(['ueberfaellig', 'faellig']);
		expect(a).toContainEqual(['ohne-kategorie', 'ohneKat']);
		expect(a).toContainEqual(['umbuchung', 'umbuchung']);
		expect(a).toContainEqual(['preisabweichung', 'teurer']);
		expect(a).toContainEqual(['auftrag-fehlt', 'weg']);
		expect(a).toContainEqual(['auftrag-betrag', 'spass']);
		expect(a).toHaveLength(12);
	});

	it('Doppelte, gelöschte und Gehalt', () => {
		const e = basis(
			[plan({ id: 'netflix1', empfaenger: 'Netflix' }), plan({ id: 'netflix2', empfaenger: 'Netflix' })],
			[
				['netflix1', fix],
				['netflix2', fix]
			]
		);
		e.verknuepft = [{ name: 'Zeitung', terminplanId: 'weg' }];
		e.gehaltKategorie = null;
		expect(artUndPlan(e)).toEqual([
			['duplikat', 'netflix2'],
			['geloescht', 'weg'],
			['gehalt-kategorie', null]
		]);
		e.gehaltKategorie = 'gehalt';
		e.letztesGehalt = null;
		expect(artUndPlan(e)).toContainEqual(['gehalt-leer', null]);
	});

	it('Aufteilung des Gemeinschafts-Dauerauftrags', () => {
		const rolle: Rolle = { typ: 'dauerauftrag', name: 'Gemeinschaftskonto' };
		const mit = (aufteilung: Terminplan['aufteilung']) => {
			const e = basis([plan({ id: 'gem', betragCent: 69674, aufteilung })], [['gem', rolle]]);
			e.dauerauftraege = [{ name: 'Gemeinschaftskonto', zielkonto: '', betragCent: 69674 }];
			e.gemeinschaft = { auftrag: 'Gemeinschaftskonto', teile: [{ name: 'Miete', kategorieId: 'miete', betragCent: 69674 }] };
			return artUndPlan(e);
		};
		expect(mit(null)).toEqual([['split-fehlt', 'gem']]);
		expect(
			mit([
				{ kategorieId: 'miete', betragCent: 60000 },
				{ kategorieId: 'urlaub', betragCent: 9674 }
			])
		).toEqual([
			['split-abweichung', 'gem'],
			['split-unbekannt', 'gem']
		]);
	});
});

describe('Meldungen am Posten', () => {
	it('ordnet Meldungen über die Terminplan-ID zu', () => {
		const e = basis(
			[plan({ id: 'netflix', letzteBuchung: { datum: '2026-10-15', betragCent: 1399 } }), plan({ id: 'spotify' })],
			[
				['netflix', fix],
				['spotify', fix]
			]
		);
		e.verknuepft = [{ name: 'Zeitung', terminplanId: 'weg' }];
		const meldungen = pruefeTerminplaene(e);
		const posten = mitMeldungen(
			[
				{ name: 'Netflix', actualTerminplan: 'netflix' },
				{ name: 'Spotify', actualTerminplan: 'spotify' },
				{ name: 'Zeitung', actualTerminplan: 'weg' },
				{ name: 'Von Hand', actualTerminplan: null },
				{ name: 'Ohne Feld' }
			],
			meldungen
		);
		expect(posten.map((p) => [p.name, p.meldungen.map((w) => w.art)])).toEqual([
			['Netflix', ['preisabweichung']],
			['Spotify', []],
			['Zeitung', ['geloescht']],
			['Von Hand', []],
			['Ohne Feld', []]
		]);
		expect(posten[0].meldungen[0]).toMatchObject({ stufe: 'warnung', tun: 'Preisänderung? Betrag im Terminplan anpassen.' });
	});

	it('zeigt ein Duplikat an beiden Posten', () => {
		const e = basis(
			[plan({ id: 'netflix1', empfaenger: 'Netflix' }), plan({ id: 'netflix2', empfaenger: 'Netflix' })],
			[
				['netflix1', fix],
				['netflix2', fix]
			]
		);
		const meldungen = pruefeTerminplaene(e);
		expect(meldungen).toMatchObject([{ art: 'duplikat', terminplanId: 'netflix2', weitereTerminplanIds: ['netflix1'] }]);
		const posten = mitMeldungen(
			[
				{ name: 'Netflix 1', actualTerminplan: 'netflix1' },
				{ name: 'Netflix 2', actualTerminplan: 'netflix2' }
			],
			meldungen
		);
		expect(posten.map((p) => p.meldungen.map((w) => w.art))).toEqual([['duplikat'], ['duplikat']]);
	});
});

describe('Schlüssel einer Ausblendung', () => {
	it('Duplikat trägt unabhängig von der Reihenfolge aus Actual dieselbe ID', () => {
		const a = plan({ id: 'netflix1', empfaenger: 'Netflix' });
		const b = plan({ id: 'netflix2', empfaenger: 'Netflix' });
		const rollen: [string, Rolle][] = [
			['netflix1', fix],
			['netflix2', fix]
		];
		const id = (plaene: Terminplan[]) => pruefeTerminplaene(basis(plaene, rollen)).map((w) => [w.terminplanId, w.weitereTerminplanIds]);
		expect(id([a, b])).toEqual([['netflix2', ['netflix1']]]);
		expect(id([b, a])).toEqual([['netflix2', ['netflix1']]]);
	});

	it('hinweisSchluessel und leseHinweisSchluessel passen zusammen', () => {
		expect(leseHinweisSchluessel(hinweisSchluessel('abc-1', 'ungefaehr'))).toEqual({ terminplan: 'abc-1', art: 'ungefaehr' });
		expect(leseHinweisSchluessel('ohne-trenner')).toBeNull();
		expect(leseHinweisSchluessel('|ungefaehr')).toBeNull();
		expect(leseHinweisSchluessel('abc|')).toBeNull();
	});
});
