import { beforeEach, describe, expect, it } from 'vitest';
import { actions, load } from '../../routes/plan/+page.server';
import { oeffneDatenbank, setzeDatenbank } from './db';
import { ladeAuftraege, ladePerson, ladeRueckstellungen, macheRueckgaengig } from './repo';

const anfrage = (felder: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(felder)) f.set(k, v);
	return { request: new Request('http://x/', { method: 'POST', body: f }), locals: { person: 'a' } } as never;
};

beforeEach(() => setzeDatenbank(oeffneDatenbank(':memory:')));

describe('Seite Mein Plan', () => {
	it('lädt Kontenmodell, Daueraufträge und Rücklagen', () => {
		const d = load({ locals: { person: 'a' } } as never) as { modus: number; auftraege: unknown[]; rueckstellungen: unknown[]; ueberweisungstag: number };
		expect(d.modus).toBe(ladePerson('a').modus);
		expect(d.ueberweisungstag).toBe(ladePerson('a').ueberweisungstag);
		expect(d.auftraege).toEqual(ladeAuftraege('a'));
		expect(Array.isArray(d.rueckstellungen)).toBe(true);
	});
});

describe('Kontenmodell', () => {
	it('wechselt das Modell und lässt sich rückgängig machen', async () => {
		// Gespeichert wird die ganze Liste neu, darum zählen die ids nicht.
		const stand = () => ({ modus: ladePerson('a').modus, auftraege: ladeAuftraege('a').map(({ id: _id, ...rest }) => rest) });
		const vorher = stand();
		const neu = vorher.modus === 1 ? 2 : 1;
		const r = (await actions.modus(anfrage({ modus: String(neu) }))) as { undoId: number; meldung: string };
		expect(r.meldung).toMatch(/Kontenmodell geändert/);
		expect(ladePerson('a').modus).toBe(neu);
		macheRueckgaengig(r.undoId, 'a');
		expect(stand()).toEqual(vorher);
	});

	it('lehnt ein unbekanntes Modell ab', async () => {
		expect(await actions.modus(anfrage({ modus: '3' }))).toMatchObject({ status: 400, data: { fehler: { modus: expect.any(String) } } });
	});
});

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
