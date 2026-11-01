import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Seite from './+page.svelte';

let app: ReturnType<typeof mount> | undefined;
afterEach(() => {
	if (app) unmount(app);
	app = undefined;
	document.body.innerHTML = '';
});

const daten = {
	namen: { ich: 'Stephan', andere: 'Partner' },
	felder: {
		netto: 'x',
		netto2: '2800,00',
		positionen: [],
		posten: [],
		zeilen: [
			{ name: 'Auto', betrag: 'x', intervall: '', wer: 'persoenlich' as const },
			{ name: 'Auto', betrag: 'y', intervall: '', wer: 'persoenlich' as const }
		]
	},
	// Zwei Zeilen mit demselben Namen ergeben denselben Text.
	fehler: { n_0: '„Auto“: Bitte einen Betrag über 0 eintragen.', n_1: '„Auto“: Bitte einen Betrag über 0 eintragen.' },
	geaendert: false,
	vergleich: [
		{
			titel: 'Rücklagen',
			zeilen: [
				{ name: 'Urlaub', heuteCent: 100, mitCent: 100, differenzCent: 0 },
				{ name: 'Urlaub', heuteCent: 200, mitCent: 200, differenzCent: 0 }
			]
		}
	],
	warnungen: { heute: ['Doppelt.', 'Doppelt.'], mit: ['Doppelt.', 'Doppelt.'] }
};

describe('Seite Rechner', () => {
	it('zeigt gleiche Meldungen, Warnungen und Namen mehrfach, ohne abzubrechen', () => {
		app = mount(Seite, { target: document.body, props: { data: daten, params: {}, form: undefined } as never });
		flushSync();
		expect([...document.querySelectorAll('.fehler li')].map((li) => li.textContent)).toEqual([daten.fehler.n_0, daten.fehler.n_1]);
		expect(document.querySelectorAll('.warnungen li')).toHaveLength(4);
		expect(document.querySelectorAll('.vergleich .zeile')).toHaveLength(2);
		expect(document.querySelector('.hinweis')!.textContent).toContain('Hier wird nichts gespeichert.');
	});
});
