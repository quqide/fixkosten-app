import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { berechneRueckstellung, type RueckstellungKonfig } from '#lib/rechnung/rueckstellung.ts';
import type { RuecklageMitStand } from '#lib/ruecklageAnzeige.ts';
import RuecklageListe from './RuecklageListe.svelte';

const server = vi.hoisted(() => ({ antwort: null as unknown, gesendet: [] as unknown[] }));
vi.mock('$app/forms', () => ({
	enhance: (form: HTMLFormElement, absenden: (x: unknown) => (y: unknown) => Promise<void>) => {
		const beiSubmit = async (e: SubmitEvent) => {
			e.preventDefault();
			const daten = new FormData(form);
			server.gesendet.push(JSON.parse(String(daten.get('rueckstellungen'))));
			await absenden({ formData: daten })({ result: server.antwort, update: async () => {} });
		};
		form.addEventListener('submit', beiSubmit);
		return { destroy: () => form.removeEventListener('submit', beiSubmit) };
	}
}));
const toast = vi.hoisted(() => vi.fn());
vi.mock('#lib/toast.svelte.ts', () => ({ zeigeToast: toast }));

beforeAll(() => {
	HTMLDialogElement.prototype.showModal = function () {
		this.open = true;
	};
	HTMLDialogElement.prototype.close = function () {
		this.open = false;
	};
});

function mitStand(id: number, x: Partial<RueckstellungKonfig>, standCent: number | null): RuecklageMitStand {
	const eintrag = {
		id, name: 'R', art: 'ziel' as const, betragCent: 20000, zielCent: 500000, zielNettoFaktor: null, faellig: null,
		zielkonto: 'Tagesgeld', wkn: null, aktiv: true, actualKategorie: null, standCent, ...x
	};
	return { eintrag, standQuelle: 'hand', hinweis: null, ...berechneRueckstellung(eintrag, { standCent, nettoCent: 345000, stichtag: '2026-11-02', ueberweisungstag: 7 }) };
}
const liste = [
	mitStand(1, { name: 'Notgroschen' }, 500000),
	mitStand(2, { name: 'Urlaub' }, 125000),
	mitStand(3, { name: 'Auto', aktiv: false }, 250000)
];

let app: ReturnType<typeof mount> | undefined;
beforeEach(() => {
	server.antwort = { type: 'success', status: 200, data: { meldung: 'Rücklagen gespeichert.', undoId: 7 } };
	server.gesendet = [];
	toast.mockReset();
	app = mount(RuecklageListe, { target: document.body, props: { rueckstellungen: liste } });
	flushSync();
});
afterEach(() => {
	if (app) unmount(app);
	app = undefined;
	document.body.innerHTML = '';
});

const knopf = (text: string | RegExp) =>
	[...document.querySelectorAll('button')].find((b) => (typeof text === 'string' ? b.textContent?.trim() === text : text.test(b.textContent ?? '')))!;
async function fertig() {
	knopf('Fertig').click();
	await tick();
	await Promise.resolve();
	flushSync();
}

describe('Rücklagen als Liste', () => {
	it('Ring und Zustand stimmen mit berechneRueckstellung überein', () => {
		const zeilen = [...document.querySelectorAll('.rows .row')];
		expect(zeilen.map((z) => z.querySelector('.ring')!.getAttribute('aria-label'))).toEqual(['100 % vom Ziel', '25 % vom Ziel', '50 % vom Ziel']);
		expect(zeilen.map((z) => z.querySelector('.zustand')!.textContent)).toEqual(['erreicht', 'läuft', 'pausiert']);
		// Monatsrate: erreicht und pausiert 0 €, laufend 200 €.
		expect(zeilen.map((z) => z.querySelector('.value')!.firstChild!.textContent)).toEqual(['0,00 €', '200,00 €', '0,00 €']);
		expect(zeilen[1].querySelector('.detail')!.textContent).toBe('1.250 € von 5.000 €');
	});

	it('„Fertig“ speichert die ganze Liste mit der Änderung, Toast mit Rückgängig', async () => {
		knopf(/Urlaub/).click();
		flushSync();
		const betrag = document.querySelector<HTMLInputElement>('#r-betrag')!;
		betrag.value = '250';
		betrag.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		await fertig();
		const gesendet = server.gesendet[0] as { id: number; name: string; betrag: string }[];
		expect(gesendet.map((r) => r.name)).toEqual(['Notgroschen', 'Urlaub', 'Auto']);
		expect(gesendet[1]).toMatchObject({ id: 2, betrag: '250', art: 'ziel', ziel: '5000,00', aktiv: true });
		expect(toast).toHaveBeenCalledWith('Rücklagen gespeichert.', 7);
		expect(document.querySelector('dialog')!.open).toBe(false);
	});

	it('Abbrechen schickt nichts ab', () => {
		knopf(/Urlaub/).click();
		flushSync();
		knopf('Abbrechen').click();
		flushSync();
		expect(server.gesendet).toEqual([]);
		expect(document.querySelector('dialog')!.open).toBe(false);
	});

	it('Prüffehler erscheinen am Feld, das Fenster bleibt offen', async () => {
		knopf('Rücklage hinzufügen').click();
		flushSync();
		server.antwort = { type: 'failure', status: 400, data: { fehler: { r_3: 'Wofür legst du das Geld zurück?', feld_3: 'name' } } };
		await fertig();
		expect(document.querySelector('#r-name-f')!.textContent).toBe('Wofür legst du das Geld zurück?');
		expect(document.querySelector('dialog')!.open).toBe(true);
		const art = document.querySelector<HTMLSelectElement>('#r-art')!;
		art.value = 'faellig';
		art.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();
		server.antwort = { type: 'failure', status: 400, data: { fehler: { r_3: '„X“: Wann wird das Geld gebraucht?', feld_3: 'faellig' } } };
		await fertig();
		expect(document.querySelector('#r-faellig-f')!.textContent).toContain('Wann wird das Geld gebraucht?');
		expect(document.querySelector('#r-name-f')).toBeNull();
	});

	it('Löschen schickt die Liste ohne die Rücklage ab', async () => {
		knopf(/Auto/).click();
		flushSync();
		knopf('Rücklage löschen').click();
		await tick();
		await Promise.resolve();
		flushSync();
		expect((server.gesendet[0] as { name: string }[]).map((r) => r.name)).toEqual(['Notgroschen', 'Urlaub']);
	});
});
