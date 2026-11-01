import { describe, expect, it } from 'vitest';
import { erzeugeVorlagen, rueckstellungsVorlage, vorlagenBetrag, vorlagenText, type VorlagenRueckstellung } from './vorlagen';

const r = (x: Partial<VorlagenRueckstellung>): VorlagenRueckstellung => ({
	name: 'Rücklage', art: 'fest', aktiv: true, kategorieId: 'k-r', betragCent: 15000, zielCent: null, faellig: null, ...x
});

describe('Budget-Vorlagen für Actual', () => {
	it('Beträge ohne Währung, mit Punkt, ohne Tausenderpunkt', () => {
		expect(vorlagenBetrag(15000)).toBe('150');
		expect(vorlagenBetrag(1250)).toBe('12.50');
		expect(vorlagenBetrag(1200000)).toBe('12000');
		expect(vorlagenBetrag(123405)).toBe('1234.05');
	});

	it('Rückstellungen: fest, bis Datum, bis Ziel, pausiert', () => {
		expect(rueckstellungsVorlage(r({ art: 'fest', betragCent: 15000 }))).toBe('#template 150');
		expect(rueckstellungsVorlage(r({ art: 'fest', betragCent: 1250 }))).toBe('#template 12.50');
		expect(rueckstellungsVorlage(r({ art: 'faellig', zielCent: 1200000, faellig: '2029-03-31' }))).toBe('#template 12000 by 2029-03');
		expect(rueckstellungsVorlage(r({ art: 'ziel', betragCent: 30000, zielCent: 1050000 }))).toBe('#template 300 up to 10500');
		expect(rueckstellungsVorlage(r({ aktiv: false }))).toBeNull();
		expect(rueckstellungsVorlage(r({ kategorieId: null }))).toBeNull();
		expect(rueckstellungsVorlage(r({ art: 'faellig', zielCent: null, faellig: '2029-03-31' }))).toBeNull();
	});

	it('gruppiert nach Kategorie, Terminplan-Namen unverändert, ohne Kategorie extra', () => {
		const v = erzeugeVorlagen({
			terminplaene: [
				{ name: 'Netflix', kategorieId: 'k-abo' },
				{ name: 'Spotify Family ', kategorieId: 'k-abo' },
				{ name: 'Strom', kategorieId: null }
			],
			rueckstellungen: [r({ name: 'Urlaub', art: 'faellig', zielCent: 1200000, faellig: '2029-03-31', kategorieId: 'k-urlaub' }), r({ name: 'Pause', aktiv: false })],
			kategorien: [
				{ id: 'k-abo', name: 'Abos' },
				{ id: 'k-urlaub', name: 'Urlaub' }
			]
		});
		expect(v.gruppen).toEqual([
			{
				kategorieId: 'k-abo',
				kategorie: 'Abos',
				zeilen: [
					{ text: '#template schedule Netflix', quelle: 'Fixkosten „Netflix“' },
					{ text: '#template schedule Spotify Family ', quelle: 'Fixkosten „Spotify Family “' }
				]
			},
			{ kategorieId: 'k-urlaub', kategorie: 'Urlaub', zeilen: [{ text: '#template 12000 by 2029-03', quelle: 'Rücklage „Urlaub“' }] }
		]);
		expect(v.ohneKategorie).toEqual(['Strom']);
		expect(vorlagenText(v.gruppen[0])).toBe('#template schedule Netflix\n#template schedule Spotify Family ');
	});
});
