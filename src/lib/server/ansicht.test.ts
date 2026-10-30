import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { oeffneDatenbank, setzeDatenbank } from './db';
import { personAnsicht, rueckstellungenMitStand } from './ansicht';
import { aenderePerson, speichereActualStand, speichereRueckstellungen, type RueckstellungEintrag } from './repo';

const stichtag = '2026-10-30';
const basis: RueckstellungEintrag = {
	person: 'a',
	name: 'Versicherung',
	art: 'faellig',
	betragCent: 0,
	zielCent: 120000,
	zielNettoFaktor: null,
	faellig: '2027-09-30',
	zielkonto: 'Tagesgeld',
	wkn: null,
	aktiv: true,
	actualKategorie: 'kat-1',
	standCent: null,
	standDatum: null
};

function mitActual() {
	// Nur Platzhalter, damit „Actual eingerichtet“ gilt; es wird nichts abgerufen.
	vi.stubEnv('ACTUAL_A_URL', 'http://actual.invalid');
	vi.stubEnv('ACTUAL_A_PASSWORD', 'test');
	vi.stubEnv('ACTUAL_A_SYNC_ID', 'test');
}

beforeEach(() => {
	setzeDatenbank(oeffneDatenbank(':memory:'));
	aenderePerson('a', { nettoCent: 300000 }, 'a', 'Test');
	speichereRueckstellungen('a', [basis], 'a');
});
afterEach(() => vi.unstubAllEnvs());

describe('Stand der Rückstellungen', () => {
	it('nimmt den Saldo aus Actual und rechnet die Rate daraus', () => {
		mitActual();
		speichereActualStand('a', { kategorieSalden: { 'kat-1': 60000 }, kategorien: [{ id: 'kat-1', name: 'Versicherungen' }] });
		const [r] = rueckstellungenMitStand('a', stichtag);
		// 600 € offen, 11 Raten (Nov bis Sep) → 54,55 € → 55 €
		expect(r).toMatchObject({ standCent: 60000, standQuelle: 'actual', hinweis: null, status: 'aktiv', rateCent: 5500, restRaten: 11 });
	});

	it('rechnet nicht mit 0 €, wenn die Kategorie im Abruf fehlt', () => {
		mitActual();
		speichereActualStand('a', { kategorieSalden: {}, kategorien: [{ id: 'kat-1', name: 'Versicherungen' }] });
		const [r] = rueckstellungenMitStand('a', stichtag);
		expect(r).toMatchObject({ standCent: null, status: 'unbekannt', rateCent: 0, hinweis: 'Kategorie „Versicherungen“ in Actual nicht gefunden.' });
	});

	it('nutzt keinen alten Abruf, wenn Actual nicht mehr eingerichtet ist', () => {
		speichereActualStand('a', { kategorieSalden: { 'kat-1': 60000 }, kategorien: [] });
		const [r] = rueckstellungenMitStand('a', stichtag);
		expect(r).toMatchObject({ standCent: null, standQuelle: null, status: 'unbekannt', rateCent: 0 });
		expect(r.hinweis).toMatch(/nicht mehr eingerichtet/);
	});

	it('zeigt in der Übersicht dieselbe Rate und warnt, wenn der Stand fehlt', () => {
		mitActual();
		speichereActualStand('a', { kategorieSalden: {}, kategorien: [] });
		const ansicht = personAnsicht('a', stichtag);
		expect(ansicht.rueckstellungen).toEqual(rueckstellungenMitStand('a', stichtag));
		expect(ansicht.aufstellung.warnungen).toContain(
			'Rücklage „Versicherung“: Kategorie in Actual nicht gefunden. Ohne Stand ist keine Rate eingeplant.'
		);
	});

	it('Bis Ziel: der Monatsbetrag läuft ohne Stand weiter', () => {
		mitActual();
		speichereRueckstellungen('a', [{ ...basis, art: 'ziel', betragCent: 10000, faellig: null }], 'a');
		const [r] = rueckstellungenMitStand('a', stichtag);
		expect(r).toMatchObject({ status: 'unbekannt', rateCent: 10000, fortschritt: null });
	});

	it('nutzt den Stand von Hand, wenn keine Kategorie verknüpft ist', () => {
		speichereRueckstellungen('a', [{ ...basis, actualKategorie: null, standCent: 120000 }], 'a');
		const [r] = rueckstellungenMitStand('a', stichtag);
		expect(r).toMatchObject({ standQuelle: 'hand', hinweis: null, status: 'erreicht', rateCent: 0 });
	});
});
