import { beforeEach, describe, expect, it } from 'vitest';
import { mitMeldungen, type Terminplan } from '#lib/rechnung/terminplan.ts';
import { ausgeblendeteHinweise, warnungenFuer } from './actualAbgleich';
import { hinweisAktionen } from './aktionen';
import { oeffneDatenbank, setzeDatenbank } from './db';
import { aenderePerson, ladeAusblendungen, macheRueckgaengig, speichereActualStand, speichereZuordnung } from './repo';

const plan = (id: string, extra: Partial<Terminplan> = {}): Terminplan => ({
	id,
	name: id,
	kontoId: 'giro',
	kontoName: 'Giro',
	empfaenger: id,
	umbuchung: false,
	betragCent: 1299,
	betragArt: 'fest',
	rhythmus: { frequenz: 'monthly', intervall: 1, muster: false },
	naechsterTermin: '2099-01-15',
	beendet: false,
	kategorieId: 'k',
	letzteBuchung: null,
	...extra
});

function anfrage(person: 'a' | 'b', hinweis: string) {
	const f = new FormData();
	f.set('hinweis', hinweis);
	return { request: new Request('http://x/', { method: 'POST', body: f }), locals: { person } } as never;
}

beforeEach(() => {
	setzeDatenbank(oeffneDatenbank(':memory:'));
	for (const id of ['a', 'b'] as const) {
		aenderePerson(id, { actualKontoId: 'giro', actualKontoName: 'Giro', actualGehaltKategorie: null } as never, id, 'x');
		speichereActualStand(id, {
			terminplaene: [
				plan('strom', { betragArt: 'ungefaehr' }),
				plan('netflix1', { empfaenger: 'Netflix' }),
				plan('netflix2', { empfaenger: 'Netflix' }),
				plan('teuer', { letzteBuchung: { datum: '2026-10-15', betragCent: 1399 } })
			],
			kategorien: []
		});
		speichereZuordnung(
			id,
			['strom', 'netflix1', 'netflix2', 'teuer'].map((t) => ({ terminplan: t, rolle: 'fixkosten' as const, dauerauftrag: null })),
			id
		);
	}
});

const arten = (id: 'a' | 'b') => warnungenFuer(id).map((w) => `${w.terminplanId}|${w.art}`);

describe('Hinweise ausblenden', () => {
	it('blendet einen Hinweis überall aus, Rückgängig holt ihn zurück', async () => {
		expect(arten('a')).toContain('strom|ungefaehr');
		const r = (await hinweisAktionen.ausblenden(anfrage('a', 'strom|ungefaehr'))) as { undoId: number };
		expect(arten('a')).not.toContain('strom|ungefaehr');
		// Posten-Symbol und Zähler auf der Übersicht rechnen mit warnungenFuer.
		expect(mitMeldungen([{ actualTerminplan: 'strom' }], warnungenFuer('a'))[0].meldungen).toEqual([]);
		expect(ausgeblendeteHinweise('a')).toMatchObject([{ terminplan: 'strom', art: 'ungefaehr', name: 'strom', meldung: { art: 'ungefaehr' } }]);
		// Die andere Person sieht ihn weiter.
		expect(arten('b')).toContain('strom|ungefaehr');
		macheRueckgaengig(r.undoId, 'a');
		expect(arten('a')).toContain('strom|ungefaehr');
	});

	it('blendet über die Liste wieder ein', async () => {
		await hinweisAktionen.ausblenden(anfrage('a', 'strom|ungefaehr'));
		await hinweisAktionen.einblenden(anfrage('a', 'strom|ungefaehr'));
		expect(arten('a')).toContain('strom|ungefaehr');
		expect(ladeAusblendungen('a')).toEqual([]);
	});

	it('ein ausgeblendetes Duplikat verschwindet an beiden Posten', async () => {
		await hinweisAktionen.ausblenden(anfrage('a', 'netflix2|duplikat'));
		const posten = mitMeldungen([{ actualTerminplan: 'netflix1' }, { actualTerminplan: 'netflix2' }], warnungenFuer('a'));
		expect(posten.map((p) => p.meldungen.length)).toEqual([0, 0]);
	});

	it('lehnt das Ausblenden einer Warnung ab', async () => {
		expect(arten('a')).toContain('teuer|preisabweichung');
		const r = (await hinweisAktionen.ausblenden(anfrage('a', 'teuer|preisabweichung'))) as { status: number };
		expect(r.status).toBe(400);
		expect(ladeAusblendungen('a')).toEqual([]);
		expect(arten('a')).toContain('teuer|preisabweichung');
	});
});
