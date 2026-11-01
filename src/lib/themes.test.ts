import { describe, expect, it } from 'vitest';
import { gueltigesThema, STANDARD_THEME, THEMES } from './themes';

/** Relative Leuchtdichte nach WCAG 2.1. */
function leuchtdichte(hex: string) {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function kontrast(a: string, b: string) {
	const [hell, dunkel] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x);
	return (hell + 0.05) / (dunkel + 0.05);
}

describe('Farbthemen', () => {
	it('es gibt elf Themen, darunter die sechs neuen', () => {
		expect(Object.keys(THEMES)).toEqual([
			'salbei', 'ozean', 'pflaume', 'koralle', 'graphit',
			'lagune', 'bernstein', 'himbeere', 'indigo', 'olive', 'nachtblau'
		]);
	});

	it.each(Object.entries(THEMES))('%s: Akzentfarbe hat mindestens 4,5 : 1 gegen die Fläche, hell und dunkel', (_, t) => {
		expect(kontrast(t.hell.tint, t.hell.surface)).toBeGreaterThanOrEqual(4.5);
		expect(kontrast(t.dunkel.tint, t.dunkel.surface)).toBeGreaterThanOrEqual(4.5);
	});

	it('alle Farben sind sechsstellige Hexwerte', () => {
		for (const t of Object.values(THEMES))
			for (const f of [...Object.values(t.hell), ...Object.values(t.dunkel)]) expect(f).toMatch(/^#[0-9a-f]{6}$/);
	});

	it('Kontrastformel stimmt (Schwarz auf Weiß 21 : 1)', () => {
		expect(kontrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
	});

	it('unbekanntes oder fehlendes Thema ergibt Salbei, gültige bleiben', () => {
		expect(STANDARD_THEME).toBe('salbei');
		expect(gueltigesThema('gibtsnicht')).toBe('salbei');
		expect(gueltigesThema('toString')).toBe('salbei');
		expect(gueltigesThema(null)).toBe('salbei');
		expect(gueltigesThema('nachtblau')).toBe('nachtblau');
		expect(gueltigesThema('ozean')).toBe('ozean');
	});
});
