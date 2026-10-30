import { beforeEach, describe, expect, it } from 'vitest';
import { oeffneDatenbank, setzeDatenbank } from './db';
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

	it('legt Daueraufträge beim ersten Laden aus den Einstellungen an und macht Änderungen rückgängig', () => {
		aenderePerson('a', { etfProzent: 20 }, 'a', 'ETF');
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

	it('lehnt Dateien ab, die keine Sicherung sind', () => {
		expect(() => importiere({ foo: 1 } as never, 'a')).toThrow('keine Sicherung');
	});
});
