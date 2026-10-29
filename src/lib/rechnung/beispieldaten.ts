import type { FixkostenPosten } from './fixkosten';

/** Beispiel-Fixkosten aus den Anforderungen, Beteiligungen direkt am Posten. */
export const beispielFixkosten: FixkostenPosten[] = [
	{ name: 'Mazda 6e Tilgung', intervallMonate: 1, betragCent: 34400, art: '30 (Freizeit)', buchungsdatum: '2026-10-01', abbuchungsart: 'Lastschrift' },
	{ name: 'Mazda 6e Versicherung', intervallMonate: 12, betragCent: 125292, art: '30 (Freizeit)', buchungsdatum: '2026-10-01', abbuchungsart: 'Lastschrift' },
	{
		name: 'iCloud',
		intervallMonate: 1,
		betragCent: 3495,
		art: '30 (Freizeit)',
		buchungsdatum: '2026-09-08',
		abbuchungsart: 'Debitkarte',
		beteiligungen: [
			{ name: 'Loreen iCloud', betragCent: 585, eingangstag: 1 },
			{ name: 'Oliver iCloud', betragCent: 1170, eingangstag: 1 },
			{ name: 'Klaus iCloud + Netflix', betragCent: 2000, eingangstag: 28 }
		]
	},
	{ name: 'Versicherung Suzuki', intervallMonate: 1, betragCent: 3481, art: '30 (Freizeit)', buchungsdatum: '2026-09-15', abbuchungsart: 'Überweisung' },
	{ name: 'Clever Fit', intervallMonate: 1, betragCent: 2990, art: '30 (Freizeit)', buchungsdatum: '2026-09-01', abbuchungsart: 'Lastschrift' },
	{ name: 'Steuer Suzuki', intervallMonate: 1, betragCent: 2900, art: '30 (Freizeit)', buchungsdatum: '2026-09-15', abbuchungsart: 'Überweisung' },
	{ name: 'Telekom', intervallMonate: 1, betragCent: 2495, art: '50 (Lebenshaltung)', buchungsdatum: '2026-08-25', abbuchungsart: 'Lastschrift' },
	{ name: 'Adobe', intervallMonate: 1, betragCent: 1799, art: '30 (Freizeit)', buchungsdatum: '2026-08-31', abbuchungsart: 'Debitkarte' },
	{
		name: 'ADAC',
		intervallMonate: 12,
		betragCent: 18900,
		art: '50 (Lebenshaltung)',
		buchungsdatum: '2026-03-02',
		beteiligungen: [{ name: 'Loreen ADAC', betragCent: 5000 }]
	},
	{ name: 'DAV Bad Tölz', intervallMonate: 12, betragCent: 7900, art: '30 (Freizeit)', buchungsdatum: '2026-01-02' },
	{ name: '1Password', intervallMonate: 12, betragCent: 6783, art: '30 (Freizeit)', buchungsdatum: '2025-11-19', abbuchungsart: 'Debitkarte' },
	{ name: 'Alpha Progression', intervallMonate: 12, betragCent: 5999, art: '30 (Freizeit)', buchungsdatum: '2026-01-29', abbuchungsart: 'Debitkarte' }
];
