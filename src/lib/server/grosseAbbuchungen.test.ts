import { beforeEach, describe, expect, it } from 'vitest';
import type { AbbuchungsMonat } from '#lib/rechnung/verlauf.ts';
import { load } from '../../routes/+page.server';
import { oeffneDatenbank, setzeDatenbank } from './db';
import { speicherePosten } from './repo';

const uebersicht = (stichtag: string) =>
	load({ locals: { person: 'a' }, url: new URL(`http://x/?stichtag=${stichtag}`) } as never) as unknown as { grosseAbbuchungen: AbbuchungsMonat[] };

beforeEach(() => setzeDatenbank(oeffneDatenbank(':memory:')));

describe('Übersicht: Größere Abbuchungen', () => {
	it('folgt dem Stichtag und nimmt nur eigene Posten', () => {
		speicherePosten({ besitzer: 'a', name: 'Kfz-Versicherung', intervallMonate: 12, betragCent: 64000, buchungsdatum: '2026-03-15', beteiligungen: [] }, 'a');
		speicherePosten({ besitzer: 'b', name: 'Fremd', intervallMonate: 12, betragCent: 1000, buchungsdatum: '2026-03-15', beteiligungen: [] }, 'b');
		expect(uebersicht('2026-11-01').grosseAbbuchungen.map((m) => m.monat)).toEqual(['2027-03']);
		// Ab dem 16.03.2027 ist die nächste Abbuchung erst 2028 fällig.
		expect(uebersicht('2027-03-16').grosseAbbuchungen.map((m) => m.monat)).toEqual(['2028-03']);
		expect(uebersicht('2026-11-01').grosseAbbuchungen.flatMap((m) => m.abbuchungen.map((a) => a.name))).toEqual(['Kfz-Versicherung']);
	});

	it('ohne seltenere Posten bleibt die Liste leer', () => {
		speicherePosten({ besitzer: 'a', name: 'Netflix', intervallMonate: 1, betragCent: 1299, buchungsdatum: '2026-10-05', beteiligungen: [] }, 'a');
		expect(uebersicht('2026-11-01').grosseAbbuchungen).toEqual([]);
	});
});
