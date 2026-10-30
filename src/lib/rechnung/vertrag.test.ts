import { describe, expect, it } from 'vitest';
import { letzterKuendigungstag, LEERER_VERTRAG, type Vertrag } from './vertrag';

const v = (x: Partial<Vertrag>): Vertrag => ({ ...LEERER_VERTRAG, ...x });
const monate = (anzahl: number) => ({ anzahl, einheit: 'monate' as const });

describe('Letzter Kündigungstag', () => {
	it('Laufzeitende minus Frist', () => {
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2026-12-31', kuendigungsfrist: monate(3) }), '2026-05-01')).toEqual({
			laufzeitEnde: '2026-12-31',
			letzterKuendigungstag: '2026-09-30',
			status: 'laeuft'
		});
	});

	it('rückt bei Verlängerung das Ende weiter', () => {
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2026-03-31', verlaengerungMonate: 12, kuendigungsfrist: monate(1) }), '2026-05-01')).toEqual({
			laufzeitEnde: '2027-03-31',
			letzterKuendigungstag: '2027-02-28',
			status: 'laeuft'
		});
		// Am Stichtag selbst bleibt das Ende stehen.
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2026-03-31', verlaengerungMonate: 12 }), '2026-03-31')?.laufzeitEnde).toBe('2026-03-31');
		// Kurze Monate verschieben den Tag nicht dauerhaft.
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2026-01-31', verlaengerungMonate: 1 }), '2026-03-15')?.laufzeitEnde).toBe('2026-03-31');
	});

	it('Monatsende: die Frist endet am letzten Tag des Monats', () => {
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2026-05-31', kuendigungsfrist: monate(3) }), '2026-01-01')?.letzterKuendigungstag).toBe('2026-02-28');
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2028-05-31', kuendigungsfrist: monate(3) }), '2026-01-01')?.letzterKuendigungstag).toBe('2028-02-29');
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2026-06-30', kuendigungsfrist: monate(3) }), '2026-01-01')?.letzterKuendigungstag).toBe('2026-03-31');
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2026-06-15', kuendigungsfrist: monate(3) }), '2026-01-01')?.letzterKuendigungstag).toBe('2026-03-15');
	});

	it('Fristen in Tagen und Wochen', () => {
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2026-03-10', kuendigungsfrist: { anzahl: 14, einheit: 'tage' } }), '2026-01-01')?.letzterKuendigungstag).toBe('2026-02-24');
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2026-03-10', kuendigungsfrist: { anzahl: 2, einheit: 'wochen' } }), '2026-01-01')?.letzterKuendigungstag).toBe('2026-02-24');
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2026-03-10' }), '2026-01-01')?.letzterKuendigungstag).toBe('2026-03-10');
	});

	it('ohne Laufzeitende: null', () => {
		expect(letzterKuendigungstag(v({ kuendigungsfrist: monate(3) }), '2026-01-01')).toBeNull();
		expect(letzterKuendigungstag(null, '2026-01-01')).toBeNull();
	});

	it('abgelaufen ohne Verlängerung', () => {
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2026-03-31', kuendigungsfrist: monate(3) }), '2026-05-01')).toEqual({
			laufzeitEnde: '2026-03-31',
			letzterKuendigungstag: '2025-12-31',
			status: 'abgelaufen'
		});
	});
});
