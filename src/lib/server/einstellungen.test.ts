import { beforeEach, describe, expect, it } from 'vitest';
import { actions } from '../../routes/einstellungen/+page.server';
import { db, oeffneDatenbank, setzeDatenbank } from './db';
import { ladeAuftraege, ladePerson, ladeRueckstellungen, macheRueckgaengig } from './repo';

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

describe('Rücklagen speichern', () => {
	const rueck = (liste: unknown[]) => {
		const f = new FormData();
		f.set('rueckstellungen', JSON.stringify(liste));
		return actions.rueckstellungen({ request: new Request('http://x/', { method: 'POST', body: f }), locals: { person: 'a' } } as never);
	};
	const notgroschen = { name: 'Notgroschen', art: 'ziel', betrag: '200', zielArt: 'netto', ziel: '3', faellig: '', wohinArt: 'konto', wohin: 'Tagesgeld', aktiv: true, kategorie: '', stand: '1000' };

	it('Fehler nennen das Feld, eine leere neue Rücklage wird nicht still übergangen', async () => {
		expect(await rueck([{ ...notgroschen, name: '' }])).toMatchObject({ status: 400, data: { fehler: { feld_0: 'name' } } });
		expect(await rueck([notgroschen, { ...notgroschen, name: 'Urlaub', art: 'faellig', ziel: '600', faellig: '' }])).toMatchObject({
			data: { fehler: { feld_1: 'faellig', r_1: expect.stringContaining('Wann') } }
		});
		expect(await rueck([{ ...notgroschen, betrag: 'viel' }])).toMatchObject({ data: { fehler: { feld_0: 'betrag' } } });
		expect(await rueck([{ ...notgroschen, ziel: '' }])).toMatchObject({ data: { fehler: { feld_0: 'ziel' } } });
	});

	it('Rückgängig nach dem Speichern stellt den vorherigen Stand her', async () => {
		await rueck([notgroschen]);
		const vorher = ladeRueckstellungen('a');
		const r = (await rueck([{ ...notgroschen, id: vorher[0].id, betrag: '350' }])) as { undoId: number; meldung: string };
		expect(r.meldung).toBe('Rücklagen gespeichert.');
		expect(ladeRueckstellungen('a')[0].betragCent).toBe(35000);
		macheRueckgaengig(r.undoId, 'a');
		// Gespeichert wird die ganze Liste neu, darum bekommt die Zeile eine neue id; alles andere ist wie vorher.
		const ohneId = (l: { id?: number }[]) => l.map(({ id: _id, ...rest }) => rest);
		expect(ohneId(ladeRueckstellungen('a'))).toEqual(ohneId(vorher));
	});
});
