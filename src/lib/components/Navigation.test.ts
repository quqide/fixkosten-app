import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aktiverBereich } from '#lib/navigation.ts';
import PersonMenue from './PersonMenue.svelte';
import TabLeiste from './TabLeiste.svelte';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));

let app: ReturnType<typeof mount> | undefined;
afterEach(() => {
	if (app) unmount(app);
	app = undefined;
	document.body.innerHTML = '';
});

const personen = [
	{ id: 'a', name: 'Stephan' },
	{ id: 'b', name: 'Partner' }
];

describe('Tab-Leiste', () => {
	it.each(['oben', 'unten'] as const)('hat vier Tabs und markiert den aktiven (%s)', (lage) => {
		app = mount(TabLeiste, { target: document.body, props: { pfad: '/plan', lage } });
		flushSync();
		const links = [...document.querySelectorAll('nav a')];
		expect(links.map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
			['Übersicht', '/'],
			['Fixkosten', '/fixkosten'],
			['Mein Plan', '/plan'],
			['Gemeinsam', '/gemeinsam']
		]);
		expect(links.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent?.trim())).toEqual(['Mein Plan']);
		expect(document.body.textContent).not.toContain('Einstellungen');
		expect(document.body.textContent).not.toContain('Rechner');
	});

	it('der Rechner gehört zu „Mein Plan“, die Einstellungen zu keinem Tab', () => {
		expect(aktiverBereich('/')).toBe('/');
		expect(aktiverBereich('/fixkosten')).toBe('/fixkosten');
		expect(aktiverBereich('/gemeinsam/')).toBe('/gemeinsam');
		expect(aktiverBereich('/rechner')).toBe('/plan');
		expect(aktiverBereich('/einstellungen')).toBeNull();
	});
});

describe('Personen-Knopf', () => {
	const oeffne = () => {
		const knopf = document.querySelector<HTMLButtonElement>('.avatar-knopf')!;
		knopf.click();
		flushSync();
		return knopf;
	};
	const menue = () => document.querySelector<HTMLElement>('.menue')!;

	it('öffnet ein Menü mit Einstellungen und Personenwechsel', () => {
		app = mount(PersonMenue, { target: document.body, props: { ich: personen[0], personen } });
		flushSync();
		expect(document.querySelector('.avatar-knopf')!.textContent?.trim()).toBe('S');
		expect(menue().hidden).toBe(true);
		const knopf = oeffne();
		expect(knopf.getAttribute('aria-expanded')).toBe('true');
		expect(menue().hidden).toBe(false);
		expect(menue().querySelector('a')!.getAttribute('href')).toBe('/einstellungen');
		const form = menue().querySelector('form')!;
		expect(form.getAttribute('action')).toBe('/wer?/waehlen');
		const wahl = [...form.querySelectorAll('button')];
		expect(wahl.map((b) => [b.value, b.getAttribute('aria-pressed')])).toEqual([
			['a', 'true'],
			['b', 'false']
		]);
	});

	it('Escape schließt das Menü und gibt den Fokus an den Knopf zurück', () => {
		app = mount(PersonMenue, { target: document.body, props: { ich: personen[0], personen } });
		flushSync();
		const knopf = oeffne();
		menue().querySelector('a')!.focus();
		menue().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		flushSync();
		expect(menue().hidden).toBe(true);
		expect(document.activeElement).toBe(knopf);
	});

	it('mit fester Person fehlt der Personenwechsel', () => {
		app = mount(PersonMenue, { target: document.body, props: { ich: personen[1], personen, festePerson: true } });
		flushSync();
		oeffne();
		expect(menue().querySelector('a')!.textContent).toBe('Einstellungen');
		expect(menue().querySelector('form')).toBeNull();
		expect(menue().textContent).not.toContain('Person wechseln');
	});
});
