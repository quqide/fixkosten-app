import { beforeEach, describe, expect, it } from 'vitest';
import { actions } from '../../routes/einstellungen/+page.server';
import { db, oeffneDatenbank, setzeDatenbank } from './db';
import { ladeAuftraege, ladePerson } from './repo';

const anfrage = (felder: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(felder)) f.set(k, v);
	return { request: new Request('http://x/', { method: 'POST', body: f }), locals: { person: 'a' } } as never;
};

beforeEach(() => setzeDatenbank(oeffneDatenbank(':memory:')));

describe('Aktion Daueraufträge', () => {
	it('lehnt doppelte Namen über das Formular ab und speichert nichts', async () => {
		const vorher = ladeAuftraege('a');
		const r = (await actions.auftraege(
			anfrage({
				auftraege: JSON.stringify([
					{ name: 'Sparen', zielkonto: 'Tagesgeld', bausteine: [{ typ: 'fest', wert: '50' }] },
					{ name: 'sparen', zielkonto: 'Depot', bausteine: [{ typ: 'fest', wert: '20' }] }
				])
			})
		)) as { status: number; data: { fehler: { allgemein: string } } };
		expect(r.status).toBe(400);
		expect(r.data.fehler.allgemein).toMatch(/doppelt/);
		expect(ladeAuftraege('a')).toEqual(vorher);
	});
});

describe('Darstellung', () => {
	const darstellung = (theme: string) => {
		const f = new FormData();
		f.set('theme', theme);
		f.set('hell', 'auto');
		return actions.darstellung({ request: new Request('http://x/', { method: 'POST', body: f }), locals: { person: 'a' } } as never);
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
