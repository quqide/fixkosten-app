import { beforeEach, describe, expect, it } from 'vitest';
import { db, oeffneDatenbank, setzeDatenbank } from './db';
import {
	aendereGemeinschaft,
	aendereModus,
	aenderePerson,
	exportiere,
	importiere,
	ladeAuftraege,
	ladeGemeinschaft,
	speichereAuftraege,
	ladePerson,
	ladePosten,
	loeschePosten,
	macheRueckgaengig,
	NichtMehrRueckgaengig,
	speicherePosten,
	type PostenEintrag
} from './repo';

const icloud: PostenEintrag = {
	besitzer: 'a',
	name: 'iCloud',
	intervallMonate: 1,
	betragCent: 3495,
	buchungsdatum: '2026-09-08',
	art: '30 (Freizeit)',
	beteiligungen: [{ name: 'Loreen', betragCent: 585, eingangstag: 1 }]
};

beforeEach(() => setzeDatenbank(oeffneDatenbank(':memory:')));

describe('Datenhaltung', () => {
	it('meldet alte Gemeinschafts-Einträge als nicht mehr rückgängig zu machen und lässt sie offen', () => {
		const vorher = ladeGemeinschaft();
		// So sah ein Eintrag aus der ersten Version aus: ohne Positionen.
		const r = db()
			.prepare('INSERT INTO aenderungen (zeit, person, bereich, text, rueckgaengig) VALUES (?, ?, ?, ?, ?)')
			.run(new Date().toISOString(), 'a', 'gemeinsam', 'Miete geändert', JSON.stringify({ typ: 'gemeinschaft', vorher: { miete_cent: 1, modell: 'A' } }));
		const id = Number(r.lastInsertRowid);
		expect(() => macheRueckgaengig(id, 'a')).toThrow(NichtMehrRueckgaengig);
		expect(() => macheRueckgaengig(id, 'a')).toThrow('Diese Änderung lässt sich nicht mehr rückgängig machen.');
		expect(db().prepare('SELECT rueckgaengig FROM aenderungen WHERE id = ?').get(id)).not.toEqual({ rueckgaengig: null });
		expect(ladeGemeinschaft()).toEqual(vorher);
	});

	it('macht Kontenmodell und angepasste Daueraufträge gemeinsam rückgängig', () => {
		const vorher = ladeAuftraege('a').map((a) => a.name);
		const id = aendereModus('a', 2, [{ name: 'Fixkosten', zielkonto: 'Fixkosten-Konto', bausteine: [{ typ: 'fixkosten' }] }], 'a');
		expect(ladePerson('a').modus).toBe(2);
		macheRueckgaengig(id, 'a');
		expect(ladePerson('a').modus).toBe(1);
		expect(ladeAuftraege('a').map((a) => a.name)).toEqual(vorher);
	});

	it('legt zwei Personen und ein leeres Gemeinschaftskonto an', () => {
		expect(ladePerson('a').name).toBe('Person 1');
		expect(ladePerson('b').ueberweisungstag).toBe(7);
		const g = ladeGemeinschaft();
		expect(g.modell).toBe('A');
		expect(g.positionen.map((p) => [p.name, p.art, p.betragCent])).toEqual([
			['Miete', 'fest', 0],
			['Lebensmittel und Alltag', 'fest', 0],
			['Gemeinsame Rücklage', 'fest', 0],
			['Gemeinsame Fixkosten', 'fixkosten', 0]
		]);
	});

	it('legt die Standard-Daueraufträge beim Start an; Laden schreibt nichts', () => {
		const anzahl = () => (db().prepare('SELECT COUNT(*) AS n FROM dauerauftraege').get() as { n: number }).n;
		const vorher = anzahl();
		expect(vorher).toBeGreaterThan(0);
		db().exec('DELETE FROM dauerauftraege');
		expect(ladeAuftraege('a')).toEqual([]);
		expect(anzahl()).toBe(0);
	});

	it('macht Änderungen an den Daueraufträgen rückgängig', () => {
		expect(ladeAuftraege('a').map((x) => x.name)).toEqual(['ETF-Sparplan', 'Gemeinschaftskonto', 'Spaßkonto']);
		const undo = speichereAuftraege('a', [{ name: 'Nur Spaß', zielkonto: 'Spaßkonto', bausteine: [{ typ: 'rest' }] }], 'a');
		expect(ladeAuftraege('a').map((x) => x.name)).toEqual(['Nur Spaß']);
		macheRueckgaengig(undo, 'a');
		expect(ladeAuftraege('a').map((x) => x.name)).toEqual(['ETF-Sparplan', 'Gemeinschaftskonto', 'Spaßkonto']);
	});

	it('übernimmt Miete, Alltag und Rücklage aus einer alten Sicherung als Positionen', () => {
		const alt = { ...exportiere(), gemeinschaft: { mieteCent: 45000, alltagCent: 65000, ruecklageCent: 10000, modell: 'A' } };
		delete (alt as { auftraege?: unknown }).auftraege;
		importiere(alt as never, 'a');
		expect(ladeGemeinschaft().positionen.map((p) => p.betragCent)).toEqual([45000, 65000, 10000, 0]);
	});

	it('speichert Posten mit Beteiligungen und trennt nach Besitzer', () => {
		speicherePosten(icloud, 'a');
		speicherePosten({ ...icloud, besitzer: 'gemeinsam', name: 'Internet', beteiligungen: [] }, 'b');
		expect(ladePosten('a')).toMatchObject([{ name: 'iCloud', beteiligungen: [{ name: 'Loreen', betragCent: 585, eingangstag: 1 }] }]);
		expect(ladePosten('gemeinsam').map((p) => p.name)).toEqual(['Internet']);
		expect(ladePosten('b')).toEqual([]);
	});

	it('macht Anlegen, Ändern und Löschen rückgängig', () => {
		const { id, undoId: angelegt } = speicherePosten(icloud, 'a');
		const { undoId: geaendert } = speicherePosten({ ...icloud, id, betragCent: 3999, beteiligungen: [] }, 'a');
		expect(ladePosten('a')[0]).toMatchObject({ betragCent: 3999, beteiligungen: [] });

		macheRueckgaengig(geaendert, 'a');
		expect(ladePosten('a')[0]).toMatchObject({ betragCent: 3495, beteiligungen: [{ name: 'Loreen' }] });

		const { undoId: geloescht } = loeschePosten(id, 'b')!;
		expect(ladePosten('a')).toEqual([]);
		macheRueckgaengig(geloescht, 'b');
		expect(ladePosten('a')[0]).toMatchObject({ id, name: 'iCloud', beteiligungen: [{ name: 'Loreen' }] });

		macheRueckgaengig(angelegt, 'a');
		expect(ladePosten('a')).toEqual([]);
	});

	it('macht Änderungen an Person und Gemeinschaftskonto nur einmal rückgängig', () => {
		const u1 = aenderePerson('a', { name: 'Stephan', nettoCent: 345000 }, 'a', 'Profil');
		const positionen = ladeGemeinschaft().positionen.map((p, i) => (i === 0 ? { ...p, betragCent: 45000 } : p));
		const u2 = aendereGemeinschaft({ positionen }, 'b', 'Miete');
		expect(ladeGemeinschaft().positionen[0]).toMatchObject({ name: 'Miete', betragCent: 45000 });
		expect(macheRueckgaengig(u1, 'a')).toMatch(/Rückgängig/);
		expect(ladePerson('a')).toMatchObject({ name: 'Person 1', nettoCent: 0 });
		expect(macheRueckgaengig(u1, 'a')).toBeNull();
		macheRueckgaengig(u2, 'a');
		expect(ladeGemeinschaft().positionen[0].betragCent).toBe(0);
	});

	it('spielt eine Sicherung vollständig wieder ein', () => {
		speicherePosten(icloud, 'a');
		aenderePerson('a', { name: 'Stephan' }, 'a', 'Profil');
		const sicherung = exportiere();

		setzeDatenbank(oeffneDatenbank(':memory:'));
		importiere(JSON.parse(JSON.stringify(sicherung)), 'a');
		expect(ladePerson('a').name).toBe('Stephan');
		expect(ladePosten('a')).toMatchObject([{ name: 'iCloud', beteiligungen: [{ name: 'Loreen' }] }]);
	});

	it('lehnt eine Sicherung mit unbekanntem Baustein ab und ändert nichts', () => {
		speicherePosten(icloud, 'a');
		const sicherung = JSON.parse(JSON.stringify(exportiere()));
		sicherung.posten = [];
		sicherung.auftraege.a = [{ name: 'Kaputt', zielkonto: 'X', bausteine: [{ typ: 'zaubern' }] }];
		const vorher = exportiere();
		expect(() => importiere(sicherung, 'a')).toThrow('ungültige Daueraufträge');
		expect(exportiere()).toEqual({ ...vorher, erstellt: expect.any(String) });
		expect(ladePosten('a')).toMatchObject([{ name: 'iCloud' }]);
	});

	it('verwirft unbekannte Symbole beim Import', () => {
		speicherePosten({ ...icloud, icon: 'wolke' }, 'a');
		const sicherung = JSON.parse(JSON.stringify(exportiere()));
		sicherung.posten[0].icon = 'constructor';
		importiere(sicherung, 'a');
		expect(ladePosten('a')[0].icon).toBeNull();
	});

	it('lehnt Dateien ab, die keine Sicherung sind', () => {
		expect(() => importiere({ foo: 1 } as never, 'a')).toThrow('keine Sicherung');
	});
});
