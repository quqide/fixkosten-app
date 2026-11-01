import { describe, expect, it } from 'vitest';
import { baldKuendbar, letzterKuendigungstag, LEERER_VERTRAG, type Vertrag } from './vertrag';

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

	it('sehr altes Ende mit Verlängerung rückt bis zum Stichtag vor', () => {
		const k = letzterKuendigungstag(v({ laufzeitEnde: '1900-01-31', verlaengerungMonate: 1 }), '2026-10-30');
		expect(k).toMatchObject({ laufzeitEnde: '2026-10-31', status: 'laeuft' });
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2020-03-31', verlaengerungMonate: 12 }), '2026-03-31')?.laufzeitEnde).toBe('2026-03-31');
		expect(letzterKuendigungstag(v({ laufzeitEnde: '2020-03-31', verlaengerungMonate: 12 }), '2026-04-01')?.laufzeitEnde).toBe('2027-03-31');
	});
});

describe('baldKuendbar', () => {
	const posten = (name: string, vertrag: Partial<Vertrag> | null) => ({ name, vertrag: vertrag && v(vertrag) });
	const stichtag = '2026-09-05';

	it('nimmt Posten im 60-Tage-Fenster, nicht später und nie ohne Vertragsangaben', () => {
		const liste = [
			posten('In 90 Tagen', { laufzeitEnde: '2026-12-04' }),
			posten('In 25 Tagen', { laufzeitEnde: '2026-12-31', kuendigungsfrist: monate(3) }),
			posten('Ohne Vertrag', null),
			posten('Nur Kundennummer', { kundennummer: 'K-1' })
		];
		expect(baldKuendbar(liste, stichtag)).toEqual([
			{ posten: liste[1], tage: 25, kuendigung: { laufzeitEnde: '2026-12-31', letzterKuendigungstag: '2026-09-30', status: 'laeuft' } }
		]);
	});

	it('Fenstergrenzen: heute und genau 60 Tage zählen, 61 und verpasste nicht', () => {
		const liste = [
			posten('Heute', { laufzeitEnde: '2026-09-05' }),
			posten('60 Tage', { laufzeitEnde: '2026-11-04' }),
			posten('61 Tage', { laufzeitEnde: '2026-11-05' }),
			// Ende noch offen, aber die Frist ist schon vorbei.
			posten('Verpasst', { laufzeitEnde: '2026-10-31', kuendigungsfrist: monate(3) })
		];
		expect(baldKuendbar(liste, stichtag).map((x) => [x.posten.name, x.tage])).toEqual([
			['Heute', 0],
			['60 Tage', 60]
		]);
	});

	it('sortiert nach Datum, abgelaufene Verträge zuerst', () => {
		const liste = [
			posten('Spät', { laufzeitEnde: '2026-10-20' }),
			posten('Abgelaufen', { laufzeitEnde: '2026-03-31' }),
			posten('Früh', { laufzeitEnde: '2026-09-10' }),
			posten('Verlängert', { laufzeitEnde: '2025-10-01', verlaengerungMonate: 12 })
		];
		const r = baldKuendbar(liste, stichtag);
		expect(r.map((x) => x.posten.name)).toEqual(['Abgelaufen', 'Früh', 'Verlängert', 'Spät']);
		expect(r[0]).toMatchObject({ tage: -158, kuendigung: { status: 'abgelaufen', laufzeitEnde: '2026-03-31' } });
		expect(r[2]).toMatchObject({ tage: 26, kuendigung: { laufzeitEnde: '2026-10-01', status: 'laeuft' } });
	});
});
