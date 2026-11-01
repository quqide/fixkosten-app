import { beforeEach, describe, expect, it } from 'vitest';
import type { Terminplan } from '#lib/rechnung/terminplan.ts';
import type { Vertrag } from '#lib/rechnung/vertrag.ts';
import { uebernehmeTerminplaene } from './actualAbgleich';
import { oeffneDatenbank, setzeDatenbank } from './db';
import { lesePosten } from './formular';
import { exportiere, importiere, ladeEinzelposten, macheRueckgaengig, speicherePosten, speichereZuordnung, type PostenEintrag } from './repo';

const vertrag: Vertrag = {
	laufzeitEnde: '2026-12-31',
	kuendigungsfrist: { anzahl: 3, einheit: 'monate' },
	verlaengerungMonate: 12,
	kundennummer: 'K-4711',
	notiz: 'Tarif prüfen'
};
const strom: PostenEintrag = { besitzer: 'a', name: 'Strom', intervallMonate: 1, betragCent: 8000, buchungsdatum: '2026-11-15', beteiligungen: [] };

function formular(felder: Record<string, string>) {
	const f = new FormData();
	for (const [k, v] of Object.entries({ name: 'Strom', betrag: '80', intervall: '1', ...felder })) f.set(k, v);
	return f;
}

beforeEach(() => setzeDatenbank(oeffneDatenbank(':memory:')));

describe('Vertragsangaben im Formular', () => {
	it('liest alle Felder', () => {
		const r = lesePosten(
			formular({ v_ende: '2026-12-31', v_frist: '3', v_einheit: 'monate', v_verlaengerung: '12', v_kundennummer: ' K-4711 ', v_notiz: 'Tarif prüfen' }),
			'a'
		);
		expect(r).toMatchObject({ eintrag: { vertrag } });
	});

	it('leere Felder ergeben keinen Vertrag', () => {
		expect(lesePosten(formular({ v_ende: '', v_frist: '', v_einheit: 'monate', v_kundennummer: '' }), 'a')).toMatchObject({ eintrag: { vertrag: null } });
	});

	it('prüft Frist, Verlängerung und Textlänge', () => {
		expect(lesePosten(formular({ v_frist: '-1' }), 'a')).toHaveProperty('fehler.v_frist');
		expect(lesePosten(formular({ v_frist: 'drei' }), 'a')).toHaveProperty('fehler.v_frist');
		expect(lesePosten(formular({ v_frist: '0' }), 'a')).toMatchObject({ eintrag: { vertrag: { kuendigungsfrist: { anzahl: 0 } } } });
		expect(lesePosten(formular({ v_verlaengerung: '0' }), 'a')).toHaveProperty('fehler.v_verlaengerung');
		expect(lesePosten(formular({ v_verlaengerung: '121' }), 'a')).toHaveProperty('fehler.v_verlaengerung');
		expect(lesePosten(formular({ v_verlaengerung: '120' }), 'a')).toMatchObject({ eintrag: { vertrag: { verlaengerungMonate: 120 } } });
		expect(lesePosten(formular({ v_kundennummer: 'x'.repeat(201) }), 'a')).toHaveProperty('fehler.v_kundennummer');
		expect(lesePosten(formular({ v_notiz: 'x'.repeat(200) }), 'a')).not.toHaveProperty('fehler');
		expect(lesePosten(formular({ v_ende: '2026-02-30' }), 'a')).toHaveProperty('fehler.v_ende');
	});
});

describe('Vertragsangaben speichern', () => {
	it('eintragen, ändern, leeren und rückgängig machen', () => {
		const { id } = speicherePosten({ ...strom, vertrag }, 'a');
		expect(ladeEinzelposten(id)?.vertrag).toEqual(vertrag);
		const { undoId: geaendert } = speicherePosten({ ...strom, id, vertrag: { ...vertrag, kundennummer: 'K-1' } }, 'a');
		expect(ladeEinzelposten(id)?.vertrag?.kundennummer).toBe('K-1');
		const { undoId: geleert } = speicherePosten({ ...strom, id, vertrag: null }, 'a');
		expect(ladeEinzelposten(id)?.vertrag).toBeNull();
		macheRueckgaengig(geleert, 'a');
		expect(ladeEinzelposten(id)?.vertrag?.kundennummer).toBe('K-1');
		macheRueckgaengig(geaendert, 'a');
		expect(ladeEinzelposten(id)?.vertrag).toEqual(vertrag);
	});

	it('ein Abruf aus Actual überschreibt die Vertragsangaben nicht', () => {
		const { id } = speicherePosten({ ...strom, actualTerminplan: 'plan-strom', vertrag }, 'a');
		speichereZuordnung('a', [{ terminplan: 'plan-strom', rolle: 'fixkosten', dauerauftrag: null }], 'a');
		const plan: Terminplan = {
			id: 'plan-strom',
			name: 'Strom neu',
			kontoId: 'giro',
			kontoName: 'Giro',
			empfaenger: 'Stadtwerke',
			umbuchung: false,
			betragCent: 9000,
			betragArt: 'fest',
			rhythmus: { frequenz: 'monthly', intervall: 1, muster: false },
			naechsterTermin: '2026-12-15',
			beendet: false,
			kategorieId: 'k',
			letzteBuchung: null
		};
		uebernehmeTerminplaene('a', [plan]);
		expect(ladeEinzelposten(id)).toMatchObject({ name: 'Strom neu', betragCent: 9000, vertrag });
	});

	it('Export und Import erhalten die Angaben, ungültige werden abgelehnt', () => {
		const { id } = speicherePosten({ ...strom, vertrag }, 'a');
		const sicherung = JSON.parse(JSON.stringify(exportiere()));
		setzeDatenbank(oeffneDatenbank(':memory:'));
		importiere(sicherung, 'a');
		expect(ladeEinzelposten(id)?.vertrag).toEqual(vertrag);

		const kaputt = JSON.parse(JSON.stringify(sicherung));
		kaputt.posten[0].vertrag.verlaengerungMonate = 500;
		expect(() => importiere(kaputt, 'a')).toThrow('ungültige Vertragsangaben bei „Strom“');
		kaputt.posten[0].vertrag = { ...vertrag, kuendigungsfrist: { anzahl: 3, einheit: 'jahre' } };
		expect(() => importiere(kaputt, 'a')).toThrow('ungültige Vertragsangaben');
		// Die vorherigen Daten bleiben unverändert.
		expect(ladeEinzelposten(id)?.vertrag).toEqual(vertrag);
	});
});
