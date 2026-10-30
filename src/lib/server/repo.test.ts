import { beforeEach, describe, expect, it } from 'vitest';
import { db, oeffneDatenbank, setzeDatenbank } from './db';
import { auftraegeFuerModus, berechneAufstellung } from '#lib/rechnung/aufstellung.ts';
import {
	aendereGemeinschaft,
	aendereModus,
	aenderePerson,
	exportiere,
	importiere,
	letzteAenderungen,
	ladeAuftraege,
	ladeAusblendungen,
	ladeGemeinschaft,
	NichtAusblendbar,
	setzeAusblendung,
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
		const zeilen = letzteAenderungen(50).length;
		expect(() => macheRueckgaengig(id, 'a')).toThrow(NichtMehrRueckgaengig);
		expect(() => macheRueckgaengig(id, 'a')).toThrow('Diese Änderung lässt sich nicht mehr rückgängig machen.');
		// Der Eintrag bleibt unverändert, zeigt aber keinen Rückgängig-Knopf, und es kommt keine Verlaufszeile dazu.
		expect(db().prepare('SELECT rueckgaengig FROM aenderungen WHERE id = ?').get(id)).toEqual({
			rueckgaengig: JSON.stringify({ typ: 'gemeinschaft', vorher: { miete_cent: 1, modell: 'A' } })
		});
		expect(letzteAenderungen(50).find((a) => a.id === id)?.kannRueckgaengig).toBe(false);
		expect(letzteAenderungen(50)).toHaveLength(zeilen);
		expect(ladeGemeinschaft()).toEqual(vorher);
	});

	it('macht Kontenmodell und angepasste Daueraufträge gemeinsam rückgängig', () => {
		const ohneId = () => ladeAuftraege('a').map(({ id: _id, ...a }) => a);
		const vorher = ohneId();
		const id = aendereModus('a', 2, [{ name: 'Fixkosten', zielkonto: 'Fixkosten-Konto', bausteine: [{ typ: 'fixkosten' }] }], 'a');
		expect(ladePerson('a').modus).toBe(2);
		// Später geändertes Netto bleibt beim Rückgängigmachen erhalten.
		aenderePerson('a', { nettoCent: 345000 }, 'a', 'Netto');
		macheRueckgaengig(id, 'a');
		expect(ladePerson('a')).toMatchObject({ modus: 1, nettoCent: 345000 });
		expect(ohneId()).toEqual(vorher);
		const a = berechneAufstellung({
			modus: 1,
			nettoCent: 345000,
			auftraege: ladeAuftraege('a'),
			rueckstellungen: [],
			gemeinschaftCent: 0,
			fixkostenMonatlichCent: 10000
		});
		expect(a.warnungen.filter((w) => w.includes('doppelt'))).toEqual([]);
	});

	it('zeigt getrennte Einträge eines alten Kontenmodell-Wechsels nicht mehr als rückgängig machbar', () => {
		const alt = (typ: string, text: string, vorher: unknown) =>
			Number(
				db()
					.prepare('INSERT INTO aenderungen (zeit, person, bereich, text, rueckgaengig) VALUES (?, ?, ?, ?, ?)')
					.run(new Date().toISOString(), 'a', 'person-a', text, JSON.stringify({ typ, person: 'a', vorher })).lastInsertRowid
			);
		const p = alt('person', 'Kontenmodell geändert', ladePerson('a'));
		const auf = alt('auftraege', 'Daueraufträge an Kontenmodell angepasst', ladeAuftraege('a'));
		for (const id of [p, auf]) {
			expect(letzteAenderungen(50).find((x) => x.id === id)?.kannRueckgaengig).toBe(false);
			expect(() => macheRueckgaengig(id, 'a')).toThrow(NichtMehrRueckgaengig);
		}
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

	it('erzeugt keine doppelten Namen und spielt die eigene Sicherung wieder ein', () => {
		// Ältere Sicherung ohne Daueraufträge, mit einer Rücklage, die wie ein Standard-Auftrag heißt.
		const alt = JSON.parse(JSON.stringify(exportiere()));
		delete alt.auftraege;
		alt.rueckstellungen = [{ person: 'a', name: 'Spaßkonto', betragCent: 1000, zielkonto: 'Tagesgeld' }];
		importiere(alt, 'a');
		const namen = ladeAuftraege('a').map((x) => x.name);
		expect(namen).toEqual(['ETF-Sparplan', 'Spaßkonto', 'Gemeinschaftskonto', 'Spaßkonto (2)']);

		// Kontenmodell wechseln, wenn schon ein Auftrag „Fixkosten“ ohne Rate existiert.
		speichereAuftraege('a', [...ladeAuftraege('a'), { name: 'Fixkosten', zielkonto: 'Tagesgeld', bausteine: [{ typ: 'fest', betragCent: 100 }] }], 'a');
		aendereModus('a', 2, auftraegeFuerModus(ladeAuftraege('a'), 2), 'a');
		// Der eigene Auftrag behält seinen Namen, der neue mit der Rate bekommt den Zusatz.
		const nachher = ladeAuftraege('a');
		expect(nachher.find((x) => x.name === 'Fixkosten')?.zielkonto).toBe('Tagesgeld');
		expect(nachher.find((x) => x.name === 'Fixkosten (2)')?.bausteine).toEqual([{ typ: 'fixkosten' }]);

		const sicherung = JSON.parse(JSON.stringify(exportiere()));
		setzeDatenbank(oeffneDatenbank(':memory:'));
		expect(() => importiere(sicherung, 'a')).not.toThrow();
		expect(ladeAuftraege('a').map((x) => x.name)).toEqual(sicherung.auftraege.a.map((x: { name: string }) => x.name));
	});

	it('spielt Sicherungen mit doppelten Namen aus älteren Ständen trotzdem ein', () => {
		const s = JSON.parse(JSON.stringify(exportiere()));
		s.auftraege.a = [
			{ name: 'Fixkosten', zielkonto: 'X', bausteine: [{ typ: 'fixkosten' }] },
			{ name: 'Fixkosten', zielkonto: 'Y', bausteine: [{ typ: 'rest' }] }
		];
		expect(importiere(s, 'a').umbenannt).toEqual(['„Fixkosten“ → „Fixkosten (2)“']);
		expect(ladeAuftraege('a').map((x) => x.name)).toEqual(['Fixkosten', 'Fixkosten (2)']);
	});

	it('benennt Namen, die kein Text sind, nicht stillschweigend um', () => {
		const s = JSON.parse(JSON.stringify(exportiere()));
		s.auftraege.a = [{ name: 42, zielkonto: 'X', bausteine: [{ typ: 'rest' }] }];
		expect(() => importiere(s, 'a')).toThrow('ungültige Daueraufträge');
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

	it('blendet Hinweise je Person aus und macht das rückgängig', () => {
		const h = { terminplan: 'netflix', art: 'ungefaehr' as const };
		const undo = setzeAusblendung('a', h, true, 'a', 'Hinweis ausgeblendet');
		expect(ladeAusblendungen('a')).toEqual([h]);
		expect(ladeAusblendungen('b')).toEqual([]);
		macheRueckgaengig(undo, 'a');
		expect(ladeAusblendungen('a')).toEqual([]);

		setzeAusblendung('a', h, true, 'a', 'Hinweis ausgeblendet');
		const wieder = setzeAusblendung('a', h, false, 'a', 'Hinweis wieder eingeblendet');
		expect(ladeAusblendungen('a')).toEqual([]);
		macheRueckgaengig(wieder, 'a');
		expect(ladeAusblendungen('a')).toEqual([h]);
	});

	it('lehnt das Ausblenden von Warnungen und Sammelmeldungen ab', () => {
		expect(() => setzeAusblendung('a', { terminplan: 'netflix', art: 'preisabweichung' }, true, 'a', 'x')).toThrow(NichtAusblendbar);
		expect(() => setzeAusblendung('a', { terminplan: '', art: 'ungefaehr' }, true, 'a', 'x')).toThrow(NichtAusblendbar);
		expect(ladeAusblendungen('a')).toEqual([]);
	});

	it('nimmt Ausblendungen in die Sicherung mit', () => {
		setzeAusblendung('a', { terminplan: 'netflix', art: 'duplikat' }, true, 'a', 'x');
		setzeAusblendung('b', { terminplan: 'strom', art: 'ungefaehr' }, true, 'b', 'x');
		const sicherung = JSON.parse(JSON.stringify(exportiere()));
		setzeDatenbank(oeffneDatenbank(':memory:'));
		importiere(sicherung, 'a');
		expect(ladeAusblendungen('a')).toEqual([{ terminplan: 'netflix', art: 'duplikat' }]);
		expect(ladeAusblendungen('b')).toEqual([{ terminplan: 'strom', art: 'ungefaehr' }]);
	});
});
