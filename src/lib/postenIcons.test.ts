import { describe, expect, it } from 'vitest';
import { iconFuer, POSTEN_ICONS, schlageIconVor } from './postenIcons';

describe('Symbole', () => {
	it('schlägt nach dem Namen vor', () => {
		expect(schlageIconVor('Netflix')).toBe('play');
		expect(schlageIconVor('Spotify Family')).toBe('musik');
		expect(schlageIconVor('Kfz-Versicherung')).toBe('auto');
		expect(schlageIconVor('Hausratversicherung')).toBe('schild');
		expect(schlageIconVor('Clever Fit')).toBe('hantel');
		expect(schlageIconVor('Kreditkarte')).toBe('karte');
		expect(schlageIconVor('Rundfunkbeitrag')).toBe('fernseher');
		expect(schlageIconVor('Miete')).toBe('haus');
		expect(schlageIconVor('Xyz')).toBeNull();
	});
	it('die eigene Wahl geht vor, Unbekanntes wird ignoriert', () => {
		expect(iconFuer('Netflix', 'herz')).toBe('herz');
		expect(iconFuer('Netflix', 'gibtsnicht')).toBe('play');
	});
	it('hat genug Auswahl', () => {
		expect(Object.keys(POSTEN_ICONS).length).toBeGreaterThanOrEqual(40);
	});
});
