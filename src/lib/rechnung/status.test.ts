import { describe, expect, it } from 'vitest';
import { vergleicheSollIst } from './status';

describe('Soll-Ist-Vergleich', () => {
	it.each([
		[190185, 190100, 'passt'],
		[190185, 190000, 'unterdeckt'],
		[190185, 192685, 'passt'],
		[190185, 192686, 'ueberdeckt']
	] as const)('Soll %i, Ist %i → %s', (sollCent, istCent, status) => {
		expect(vergleicheSollIst({ sollCent, istCent }).status).toBe(status);
	});

	it('rechnet ausstehende Daueraufträge vom Ist ab (Gehalt da, Daueraufträge noch nicht)', () => {
		const v = vergleicheSollIst({ sollCent: 50000, istCent: 400000, ausstehendCent: 340000 });
		expect(v.istBereinigtCent).toBe(60000);
		expect(v.status).toBe('ueberdeckt');
		expect(v.entnehmbarCent).toBe(10000);
	});
});
