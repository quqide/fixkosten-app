import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import KontenWahl from './KontenWahl.svelte';

const server = vi.hoisted(() => ({ antwort: null as unknown, gesendet: [] as string[] }));
vi.mock('$app/forms', () => ({
	enhance: (form: HTMLFormElement, absenden: (x: unknown) => ((y: unknown) => Promise<void>) | void) => {
		const beiSubmit = async (e: SubmitEvent) => {
			e.preventDefault();
			const daten = new FormData(form);
			let abgebrochen = false;
			const weiter = absenden({ formData: daten, cancel: () => (abgebrochen = true) });
			if (abgebrochen) return;
			server.gesendet.push(String(daten.get('modus')));
			await weiter?.({ result: server.antwort, update: async () => {} });
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

let app: ReturnType<typeof mount> | undefined;
beforeEach(() => {
	server.antwort = { type: 'success', status: 200, data: { meldung: 'Kontenmodell geändert, Daueraufträge angepasst.', undoId: 4 } };
	server.gesendet = [];
	toast.mockReset();
	app = mount(KontenWahl, { target: document.body, props: { modus: 1 } });
	flushSync();
});
afterEach(() => {
	if (app) unmount(app);
	app = undefined;
	document.body.innerHTML = '';
});

const knopf = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const fertig = async () => {
	knopf('Fertig').click();
	await tick();
	await new Promise((r) => setTimeout(r));
	flushSync();
};

describe('Kontenmodell', () => {
	it('zeigt das gewählte Modell und öffnet das Fenster mit beiden Modellen', () => {
		expect(document.querySelector('button.row')!.textContent).toContain('Spaßkonto mit festem Betrag');
		(document.querySelector('button.row') as HTMLButtonElement).click();
		flushSync();
		expect(document.querySelector('dialog')!.open).toBe(true);
		const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="modus"]')];
		expect(radios.map((r) => [r.value, r.checked])).toEqual([
			['1', true],
			['2', false]
		]);
	});

	it('Fertig speichert das neue Modell mit Rückgängig', async () => {
		(document.querySelector('button.row') as HTMLButtonElement).click();
		flushSync();
		document.querySelector<HTMLInputElement>('input[value="2"]')!.click();
		flushSync();
		await fertig();
		expect(server.gesendet).toEqual(['2']);
		expect(toast).toHaveBeenCalledWith('Kontenmodell geändert, Daueraufträge angepasst.', 4);
		expect(document.querySelector('dialog')!.open).toBe(false);
	});

	it('ohne Änderung schließt Fertig nur', async () => {
		(document.querySelector('button.row') as HTMLButtonElement).click();
		flushSync();
		await fertig();
		expect(server.gesendet).toEqual([]);
		expect(toast).not.toHaveBeenCalled();
		expect(document.querySelector('dialog')!.open).toBe(false);
	});
});
