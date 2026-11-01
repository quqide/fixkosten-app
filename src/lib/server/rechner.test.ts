import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import * as seite from '../../routes/rechner/+page.server';
import * as repo from './repo';
import { oeffneDatenbank, setzeDatenbank } from './db';

type Daten = {
	fehler: Record<string, string>;
	geaendert: boolean;
	vergleich: { titel: string; zeilen: { name: string; heuteCent: number | null; mitCent: number | null; differenzCent: number }[] }[];
	felder: { netto: string; positionen: { id: number; name: string; wert: string }[]; posten: { id: number; ohne: boolean }[] };
};
const rechner = (q = '') => seite.load({ locals: { person: 'a' }, url: new URL(`http://x/rechner${q}`) } as never) as unknown as Daten;
const zeilen = (d: Daten) => d.vergleich.flatMap((g) => g.zeilen);

beforeEach(() => {
	setzeDatenbank(oeffneDatenbank(':memory:'));
	repo.aenderePerson('a', { nettoCent: 345000 }, 'a', 'Test');
	repo.aenderePerson('b', { nettoCent: 280000 }, 'b', 'Test');
	repo.speicherePosten({ besitzer: 'a', name: 'Handy', intervallMonate: 1, betragCent: 2000, buchungsdatum: '2026-10-05', beteiligungen: [] }, 'a');
	repo.speicherePosten({ besitzer: 'gemeinsam', name: 'Internet', intervallMonate: 1, betragCent: 4000, buchungsdatum: '2026-10-05', beteiligungen: [] }, 'a');
});

describe('Seite Rechner', () => {
	it('schreibt nichts: keine Form-Actions, keine Speicherfunktionen, Daten unverändert', () => {
		expect('actions' in seite).toBe(false);
		const quelle = readFileSync(new URL('../../routes/rechner/+page.server.ts', import.meta.url), 'utf8');
		const schreibend = Object.keys(repo).filter((n) => !/^(lade|letzte|exportiere|anderePerson|vervollstaendige)/.test(n) && /^[a-z]/.test(n));
		expect(schreibend).toContain('speicherePosten');
		for (const n of schreibend) expect(quelle, n).not.toMatch(new RegExp(`\\b${n}\\b`));
		expect(quelle).not.toMatch(/from '#lib\/server\/repo/);

		const stand = () => JSON.stringify({ ...repo.exportiere(), erstellt: null });
		const vorher = stand();
		const aenderungen = repo.letzteAenderungen(100).length;
		rechner('?netto=5000&netto2=1&ohne=1&n_name=Auto&n_betrag=300&n_intervall=1&n_wer=gemeinsam');
		expect(stand()).toBe(vorher);
		expect(repo.letzteAenderungen(100)).toHaveLength(aenderungen);
	});

	it('ohne Parameter: heute und mit Änderung gleich, Felder mit heutigen Werten', () => {
		const d = rechner();
		expect(d.geaendert).toBe(false);
		expect(d.fehler).toEqual({});
		expect(zeilen(d).length).toBeGreaterThan(5);
		expect(zeilen(d).every((z) => z.differenzCent === 0 && z.heuteCent === z.mitCent)).toBe(true);
		expect(d.felder.netto).toBe('3450,00');
		expect(d.felder.positionen.map((p) => p.name)).toContain('Miete');
	});

	it('die abgeschickten heutigen Werte ergeben ebenfalls keine Differenz', () => {
		const d = rechner(`?netto=3450,00&netto2=2800,00&n_name=&n_betrag=&n_intervall=&n_wer=persoenlich`);
		expect(zeilen(d).every((z) => z.differenzCent === 0)).toBe(true);
	});

	it('zusätzlicher gemeinsamer Posten 120 € jährlich: gemeinsame Fixkosten +10 €', () => {
		const d = rechner('?n_name=Rundfunk&n_betrag=120&n_intervall=12&n_wer=gemeinsam');
		expect(zeilen(d).find((z) => z.name === 'Gemeinsame Fixkosten')).toEqual({ name: 'Gemeinsame Fixkosten', heuteCent: 4000, mitCent: 5000, differenzCent: 1000 });
	});

	it('ungültige Parameter führen zu einer Meldung, nicht zu einem Fehler', () => {
		const d = rechner('?netto=abc&n_name=Auto&n_betrag=300&n_intervall=-2&ohne=xyz&pos_999=1');
		expect(Object.keys(d.fehler).sort()).toEqual(['n_0', 'netto']);
		expect(zeilen(d).every((z) => z.differenzCent === 0)).toBe(true);
		expect(d.felder.netto).toBe('abc');
	});
});
