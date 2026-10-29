import { describe, expect, it } from 'vitest';
import { leseBetrag, leseProzent } from './eingabe';

describe('leseBetrag', () => {
	it.each([
		['34,95', 3495],
		['1.252,92 €', 125292],
		['1252.92', 125292],
		['1.000', 100000],
		['450', 45000],
		['-5,85', -585],
		[' 7 € ', 700]
	])('%s → %i Cent', (text, cent) => {
		expect(leseBetrag(text)).toBe(cent);
	});

	it.each(['', 'abc', '12,3,4'])('„%s“ ist kein Betrag', (text) => {
		expect(leseBetrag(text)).toBeNull();
	});
});

describe('leseProzent', () => {
	it('versteht Komma und Prozentzeichen', () => {
		expect(leseProzent('12,5 %')).toBe(12.5);
		expect(leseProzent('20')).toBe(20);
		expect(leseProzent('')).toBeNull();
	});
});
