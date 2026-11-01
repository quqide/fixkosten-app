import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Terminplan } from '#lib/rechnung/terminplan.ts';
import { load } from '../../routes/einstellungen/+page.server';
import { budgetVorlagen } from './actualAbgleich';
import { oeffneDatenbank, setzeDatenbank } from './db';
import { speichereActualStand, speichereRueckstellungen, speichereZuordnung, vervollstaendigeRueckstellung } from './repo';

const plan = (id: string, name: string, kategorieId: string | null, extra: Partial<Terminplan> = {}): Terminplan => ({
	id, name, kontoId: 'giro', kontoName: 'Giro', empfaenger: name, umbuchung: false, betragCent: 1299, betragArt: 'fest',
	rhythmus: { frequenz: 'monthly', intervall: 1, muster: false }, naechsterTermin: '2099-01-15', beendet: false,
	kategorieId, letzteBuchung: null, ...extra
});

function mitActual() {
	// Nur Platzhalter, damit „Actual eingerichtet“ gilt; es wird nichts abgerufen.
	vi.stubEnv('ACTUAL_A_URL', 'http://actual.invalid');
	vi.stubEnv('ACTUAL_A_PASSWORD', 'test');
	vi.stubEnv('ACTUAL_A_SYNC_ID', 'test');
}

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
	setzeDatenbank(oeffneDatenbank(':memory:'));
	speichereActualStand('a', {
		terminplaene: [
			plan('p1', 'Netflix', 'k-abo'),
			plan('p2', 'Spotify', 'k-abo'),
			plan('p3', 'Strom', null),
			plan('p4', 'Altvertrag', 'k-abo', { beendet: true }),
			plan('p5', 'Miete', 'k-miete')
		],
		kategorien: [
			{ id: 'k-abo', name: 'Abos', einnahme: false },
			{ id: 'k-miete', name: 'Miete', einnahme: false },
			{ id: 'k-urlaub', name: 'Urlaub', einnahme: false }
		],
		kategorieSalden: { 'k-urlaub': 0 }
	});
	speichereZuordnung(
		'a',
		[
			...['p1', 'p2', 'p3', 'p4'].map((t) => ({ terminplan: t, rolle: 'fixkosten' as const, dauerauftrag: null })),
			{ terminplan: 'p5', rolle: 'ignorieren' as const, dauerauftrag: null }
		],
		'a'
	);
	speichereRueckstellungen(
		'a',
		[
			vervollstaendigeRueckstellung({ person: 'a', name: 'Urlaub', art: 'faellig', betragCent: 0, zielCent: 1200000, faellig: '2029-03-31', actualKategorie: 'k-urlaub' }),
			vervollstaendigeRueckstellung({ person: 'a', name: 'Pause', art: 'fest', betragCent: 5000, aktiv: false, actualKategorie: 'k-urlaub' })
		],
		'a'
	);
});

describe('Budget-Vorlagen für Actual', () => {
	it('zwei Fixkosten derselben Kategorie unter einer Überschrift, je eine Zeile', () => {
		mitActual();
		const v = budgetVorlagen('a')!;
		expect(v.gruppen.map((g) => [g.kategorie, g.zeilen.map((z) => z.text)])).toEqual([
			['Abos', ['#template schedule Netflix', '#template schedule Spotify']],
			['Urlaub', ['#template 12000 by 2029-03']]
		]);
		// Beendete und nicht als Fixkosten zugeordnete Pläne fehlen, Strom hat keine Kategorie.
		expect(v.ohneKategorie).toEqual(['Strom']);
	});

	it('ohne eingerichtetes Actual gibt es keinen Abschnitt', () => {
		expect(budgetVorlagen('a')).toBeNull();
		const daten = load({ locals: { person: 'a' } } as never) as unknown as { actual: boolean; vorlagen: unknown };
		expect(daten.actual).toBe(false);
		expect(daten.vorlagen).toBeNull();
	});

	it('mit Actual liefert die Einstellungsseite die Vorlagen', () => {
		mitActual();
		const daten = load({ locals: { person: 'a' } } as never) as unknown as { actual: boolean; vorlagen: { gruppen: unknown[] } };
		expect(daten.actual).toBe(true);
		expect(daten.vorlagen.gruppen).toHaveLength(2);
	});
});
