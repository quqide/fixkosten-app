import { beforeEach, describe, expect, it } from 'vitest';
import { actions } from '../../routes/einstellungen/+page.server';
import { oeffneDatenbank, setzeDatenbank } from './db';
import { ladeAuftraege } from './repo';

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
