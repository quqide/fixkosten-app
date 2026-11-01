import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Zeile } from '#lib/rechnung/fixkosten.ts';
import { LEERER_VERTRAG, type Vertrag } from '#lib/rechnung/vertrag.ts';
import PostenListe from './PostenListe.svelte';

let app: ReturnType<typeof mount> | undefined;
afterEach(() => {
	if (app) unmount(app);
	app = undefined;
	document.body.innerHTML = '';
});

const zeile: Zeile = {
	name: 'Handy', gehoertZu: null, intervallMonate: 1, betragCent: 2000, art: null, monatlichCent: 2000,
	letzteBuchung: null, naechsteBuchung: null, ratenSeitBuchung: 0, sollCent: 0
};

/** Unterzeile eines Postens mit diesen Vertragsangaben am Stichtag. */
function unterzeile(vertrag: Partial<Vertrag>, stichtag: string) {
	const posten = { id: 1, besitzer: 'a' as const, name: 'Handy', intervallMonate: 1, betragCent: 2000, buchungsdatum: null, beteiligungen: [], vertrag: { ...LEERER_VERTRAG, ...vertrag } };
	app = mount(PostenListe, { target: document.body, props: { eintraege: [{ posten, zeile, beteiligungen: [] }], bearbeiten: () => {}, stichtag } });
	flushSync();
	return document.querySelector('.detail')!.textContent!;
}

describe('Vertrag in der Fixkosten-Liste', () => {
	const frist = { anzahl: 3, einheit: 'monate' as const };

	it('zeigt den letzten Kündigungstag', () => {
		expect(unterzeile({ laufzeitEnde: '2026-12-31', kuendigungsfrist: frist }, '2026-09-01')).toContain('kündbar bis 30.09.2026');
	});

	it('zeigt keine schon verpasste Frist als „kündbar bis“', () => {
		const ohne = unterzeile({ laufzeitEnde: '2026-12-31', kuendigungsfrist: frist }, '2026-11-01');
		expect(ohne).not.toContain('kündbar bis');
		expect(ohne).toContain('Frist verpasst, läuft bis 31.12.2026');
		unmount(app!);
		const mit = unterzeile({ laufzeitEnde: '2026-12-31', kuendigungsfrist: frist, verlaengerungMonate: 12 }, '2026-11-01');
		expect(mit).toContain('verlängert sich am 31.12.2026');
	});

	it('zeigt abgelaufene Verträge', () => {
		expect(unterzeile({ laufzeitEnde: '2026-03-31' }, '2026-11-01')).toContain('Laufzeit am 31.03.2026 abgelaufen');
	});
});
