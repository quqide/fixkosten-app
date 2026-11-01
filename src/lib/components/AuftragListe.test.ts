import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuftragKonfig } from '#lib/rechnung/aufstellung.ts';
import AuftragListe from './AuftragListe.svelte';

/** Antwort, die das nächste Abschicken bekommt, und was abgeschickt wurde. */
const server = vi.hoisted(() => ({ antwort: null as unknown, gesendet: [] as { action: string; auftraege: unknown }[] }));
vi.mock('$app/forms', () => ({
	enhance: (form: HTMLFormElement, absenden: (x: unknown) => (y: unknown) => Promise<void>) => {
		const beiSubmit = async (e: SubmitEvent) => {
			e.preventDefault();
			const daten = new FormData(form);
			server.gesendet.push({ action: form.getAttribute('action')!, auftraege: JSON.parse(String(daten.get('auftraege'))) });
			const weiter = absenden({ formData: daten });
			await weiter({ result: server.antwort, update: async () => {} });
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

const auftraege: AuftragKonfig[] = [
	{ name: 'ETF-Sparplan', zielkonto: 'Depot', bausteine: [{ typ: 'prozent', prozent: 20 }], rundung: null },
	{ name: 'Spaß', zielkonto: 'Spaßkonto', bausteine: [{ typ: 'rest' }], rundung: null }
];
const basis = { modus: 1 as const, nettoCent: 345000, rueckstellungen: [], gemeinschaftCent: 75000, fixkostenMonatlichCent: 60000 };

let app: ReturnType<typeof mount> | undefined;
beforeEach(() => {
	server.antwort = { type: 'success', status: 200, data: { meldung: 'Daueraufträge gespeichert.', undoId: 42 } };
	server.gesendet = [];
	toast.mockReset();
	app = mount(AuftragListe, { target: document.body, props: { auftraege, basis } });
	flushSync();
});
afterEach(() => {
	if (app) unmount(app);
	app = undefined;
	document.body.innerHTML = '';
});

const knopf = (text: string | RegExp) =>
	[...document.querySelectorAll('button')].find((b) => (typeof text === 'string' ? b.textContent?.trim() === text : text.test(b.textContent ?? '')))!;
const dialog = () => document.querySelector('dialog')!;
const vorschau = () => document.querySelector('.vorschau strong')!.textContent;
function tippe(feld: HTMLInputElement, wert: string) {
	feld.value = wert;
	feld.dispatchEvent(new Event('input', { bubbles: true }));
	flushSync();
}
async function fertig() {
	knopf('Fertig').click();
	await tick();
	await Promise.resolve();
	flushSync();
}

describe('Daueraufträge als Liste', () => {
	it('zeigt je Zeile Name, Formel im Klartext mit Ziel und den Betrag dieses Monats', () => {
		const zeilen = [...document.querySelectorAll('.rows .row')];
		expect(zeilen[0].querySelector('.title')!.textContent).toBe('ETF-Sparplan');
		expect(zeilen[0].querySelector('.detail')!.textContent).toBe('20 % vom Netto aufs Depot');
		expect(zeilen[0].querySelector('.value')!.textContent).toBe('690,00 €');
		// Rest: 3.450 − 690 − 600 Fixkosten = 2.160, auf 1 € abgerundet.
		expect(zeilen[1].querySelector('.detail')!.textContent).toBe('was übrig bleibt aufs Spaßkonto');
		expect(zeilen[1].querySelector('.value')!.textContent).toBe('2.160,00 €');
	});

	it('Prozent ändern zeigt die Vorschau sofort, „Fertig“ speichert die ganze Liste', async () => {
		knopf(/ETF-Sparplan/).click();
		flushSync();
		expect(dialog().open).toBe(true);
		expect(vorschau()).toBe('690,00 €');
		tippe(document.querySelector<HTMLInputElement>('[aria-label="Prozent vom Netto"]')!, '25');
		expect(vorschau()).toBe('862,50 €');
		expect(server.gesendet).toEqual([]);

		await fertig();
		expect(server.gesendet).toHaveLength(1);
		expect(server.gesendet[0]).toMatchObject({
			action: '?/auftraege',
			auftraege: [
				{ name: 'ETF-Sparplan', zielkonto: 'Depot', bausteine: [{ typ: 'prozent', wert: '25' }] },
				{ name: 'Spaß', bausteine: [{ typ: 'rest', wert: '' }] }
			]
		});
		expect(toast).toHaveBeenCalledWith('Daueraufträge gespeichert.', 42);
		expect(dialog().open).toBe(false);
	});

	it('Abbrechen verwirft die Änderung und schickt nichts ab', () => {
		knopf(/ETF-Sparplan/).click();
		flushSync();
		tippe(document.querySelector<HTMLInputElement>('[aria-label="Prozent vom Netto"]')!, '50');
		knopf('Abbrechen').click();
		flushSync();
		expect(dialog().open).toBe(false);
		expect(server.gesendet).toEqual([]);
		knopf(/ETF-Sparplan/).click();
		flushSync();
		expect(document.querySelector<HTMLInputElement>('[aria-label="Prozent vom Netto"]')!.value).toBe('20');
	});

	it('Verschieben ändert die Reihenfolge der abgeschickten Liste', async () => {
		knopf(/Spaß/).click();
		flushSync();
		expect(document.querySelector('.reihenfolge .help')!.textContent).toBe('Platz 2 von 2');
		knopf('↑ Nach oben').click();
		flushSync();
		expect(document.querySelector('.reihenfolge .help')!.textContent).toBe('Platz 1 von 2');
		await fertig();
		expect((server.gesendet[0].auftraege as { name: string }[]).map((a) => a.name)).toEqual(['Spaß', 'ETF-Sparplan']);
	});

	it('Fehler der Prüfung stehen im Fenster am betroffenen Feld, das Fenster bleibt offen', async () => {
		knopf('Dauerauftrag hinzufügen').click();
		flushSync();
		tippe(document.querySelector<HTMLInputElement>('#a-name')!, 'etf-sparplan');
		server.antwort = {
			type: 'failure',
			status: 400,
			data: { bereich: 'auftraege', fehler: { allgemein: 'Der Name kommt doppelt vor.', a_0: 'Der Name kommt doppelt vor.', feld_0: 'name', a_2: 'Der Name kommt doppelt vor.', feld_2: 'name' } }
		};
		await fertig();
		expect(dialog().open).toBe(true);
		expect(document.querySelector('#a-name-f')!.textContent).toBe('Der Name kommt doppelt vor.');
		expect(document.querySelector('#a-name')!.getAttribute('aria-invalid')).toBe('true');
		expect(toast).not.toHaveBeenCalled();

		server.antwort = { type: 'failure', status: 400, data: { fehler: { a_2: 'Nur ein Dauerauftrag kann bekommen, was übrig bleibt.', feld_2: 'teile' } } };
		await fertig();
		expect(document.querySelector('#a-name-f')).toBeNull();
		expect(document.querySelector('#a-teile-f')!.textContent).toContain('Nur ein Dauerauftrag');
	});

	it('löschen schickt die Liste ohne den Auftrag ab', async () => {
		knopf(/ETF-Sparplan/).click();
		flushSync();
		knopf('Dauerauftrag löschen').click();
		await tick();
		await Promise.resolve();
		flushSync();
		expect((server.gesendet[0].auftraege as { name: string }[]).map((a) => a.name)).toEqual(['Spaß']);
		expect(dialog().open).toBe(false);
	});
});
