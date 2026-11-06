import { beforeEach, describe, expect, it } from 'vitest';
import { actions as darstellungActions } from '../../routes/einstellungen/darstellung/+page.server';
import { actions as datenActions } from '../../routes/einstellungen/daten/+page.server';
import { actions as profilActions, load as profilLaden } from '../../routes/einstellungen/profil/+page.server';
import { load as verlaufLaden } from '../../routes/einstellungen/verlauf/+page.server';
import { db, oeffneDatenbank, setzeDatenbank } from './db';
import { ladePerson, macheRueckgaengig } from './repo';

const anfrage = (felder: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(felder)) f.set(k, v);
	return { request: new Request('http://x/', { method: 'POST', body: f }), locals: { person: 'a' } } as never;
};

beforeEach(() => setzeDatenbank(oeffneDatenbank(':memory:')));

describe('Darstellung', () => {
	const darstellung = (theme: string) => {
		const f = new FormData();
		f.set('theme', theme);
		f.set('hell', 'auto');
		return darstellungActions.darstellung({ request: new Request('http://x/', { method: 'POST', body: f }), locals: { person: 'a' } } as never);
	};

	it('neue Themen lassen sich wählen und bleiben gespeichert', async () => {
		await darstellung('lagune');
		expect(ladePerson('a').theme).toBe('lagune');
	});

	it('ein gespeichertes unbekanntes Thema ergibt Salbei', async () => {
		db().prepare(`UPDATE personen SET theme = 'verschwunden' WHERE id = 'a'`).run();
		expect(ladePerson('a').theme).toBe('salbei');
		// Und ein unbekanntes Thema lässt sich nicht speichern.
		expect(await darstellung('verschwunden')).toMatchObject({ status: 400 });
	});
});

describe('Unterseiten der Einstellungen', () => {
	const anfrage = (felder: Record<string, string | File>) => {
		const f = new FormData();
		for (const [k, v] of Object.entries(felder)) f.set(k, v);
		return { request: new Request('http://x/', { method: 'POST', body: f }), locals: { person: 'a' } } as never;
	};

	it('Über dich speichert wie vorher, Fehler am Feld, mit Rückgängig', async () => {
		const vorher = ladePerson('a');
		expect((profilLaden({ locals: { person: 'a' } } as never) as { person: unknown }).person).toEqual(vorher);
		expect(await profilActions.profil(anfrage({ name: '', netto: 'x', tag: '40', puffer: '25' }))).toMatchObject({
			status: 400,
			data: { bereich: 'profil', fehler: { name: expect.any(String), netto: expect.any(String), tag: expect.any(String) } }
		});
		const r = (await profilActions.profil(anfrage({ name: 'Stephan', netto: '3600', tag: '6', puffer: '30' }))) as { undoId: number };
		expect(ladePerson('a')).toMatchObject({ name: 'Stephan', nettoCent: 360000, ueberweisungstag: 6, pufferCent: 3000 });
		macheRueckgaengig(r.undoId, 'a');
		expect(ladePerson('a')).toEqual(vorher);
	});

	it('Deine Daten: Einspielen ohne Datei und mit kaputter Datei meldet einen Fehler am Feld', async () => {
		expect(await datenActions.import(anfrage({}))).toMatchObject({ status: 400, data: { fehler: { datei: expect.stringContaining('wähle') } } });
		const kaputt = new File(['{kein json'], 'sicherung.json', { type: 'application/json' });
		expect(await datenActions.import(anfrage({ datei: kaputt }))).toMatchObject({ data: { fehler: { datei: 'Die Datei ist keine gültige Sicherung.' } } });
	});

	it('Letzte Änderungen zeigen die Einträge beider Personen mit Namen', async () => {
		await profilActions.profil(anfrage({ name: 'Stephan', netto: '3600', tag: '6', puffer: '30' }));
		const d = verlaufLaden({ locals: { person: 'a' } } as never) as { verlauf: { text: string; person: string }[]; namen: Record<string, string> };
		expect(d.verlauf[0]).toMatchObject({ text: 'Gehalt und Sparen geändert', person: 'a' });
		expect(d.namen.a).toBe('Stephan');
	});
});
