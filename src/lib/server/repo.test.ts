import { beforeEach, describe, expect, it } from 'vitest';
import { oeffneDatenbank, setzeDatenbank } from './db';
import {
	aendereGemeinschaft,
	aenderePerson,
	exportiere,
	importiere,
	ladeGemeinschaft,
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
	it('legt zwei Personen und ein leeres Gemeinschaftskonto an', () => {
		expect(ladePerson('a').name).toBe('Person 1');
		expect(ladePerson('b').ueberweisungstag).toBe(7);
		expect(ladeGemeinschaft()).toEqual({ mieteCent: 0, alltagCent: 0, ruecklageCent: 0, modell: 'A' });
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
		const u2 = aendereGemeinschaft({ mieteCent: 45000 }, 'b', 'Miete');
		expect(macheRueckgaengig(u1, 'a')).toMatch(/Rückgängig/);
		expect(ladePerson('a')).toMatchObject({ name: 'Person 1', nettoCent: 0 });
		expect(macheRueckgaengig(u1, 'a')).toBeNull();
		macheRueckgaengig(u2, 'a');
		expect(ladeGemeinschaft().mieteCent).toBe(0);
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
