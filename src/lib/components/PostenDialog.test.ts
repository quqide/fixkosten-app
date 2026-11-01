import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Vertrag } from '#lib/rechnung/vertrag.ts';
import PostenDialog from './PostenDialog.svelte';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

beforeAll(() => {
	// jsdom kennt showModal/close nicht.
	HTMLDialogElement.prototype.showModal = function () {
		this.open = true;
	};
	HTMLDialogElement.prototype.close = function () {
		this.open = false;
	};
});

let app: ReturnType<typeof mount> | undefined;
afterEach(() => {
	if (app) unmount(app);
	app = undefined;
	document.body.innerHTML = '';
});

function oeffne(vertrag: Vertrag | null = null) {
	app = mount(PostenDialog, {
		target: document.body,
		props: {
			posten: { name: 'Handy', betragCent: 1000, intervallMonate: 1, buchungsdatum: null, besitzer: 'a', beteiligungen: [], vertrag }
		}
	});
	flushSync();
}

function tippe(name: string, wert: string) {
	const feld = document.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
	feld.value = wert;
	feld.dispatchEvent(new Event('input', { bubbles: true }));
	flushSync();
	return feld;
}

const abschnitt = () => document.querySelector<HTMLDetailsElement>('details.vertrag')!;

describe('Vertrag im Posten-Dialog', () => {
	it('behält Eingaben und bleibt offen, auch beim Leeren', () => {
		oeffne();
		expect(abschnitt().open).toBe(false);
		abschnitt().open = true;
		abschnitt().dispatchEvent(new Event('toggle'));
		flushSync();

		expect(tippe('v_frist', '3').value).toBe('3');
		expect(tippe('v_ende', '2026-12-31').value).toBe('2026-12-31');
		expect(document.querySelector<HTMLInputElement>('[name="v_frist"]')!.value).toBe('3');
		expect(abschnitt().textContent).toContain('Kündigen bis');

		tippe('v_ende', '');
		tippe('v_frist', '');
		expect(abschnitt().open).toBe(true);
	});

	it('ist beim Öffnen aufgeklappt, wenn Angaben gespeichert sind', () => {
		oeffne({ laufzeitEnde: null, kuendigungsfrist: null, verlaengerungMonate: null, kundennummer: 'K-1', notiz: null });
		expect(abschnitt().open).toBe(true);
		expect(tippe('v_kundennummer', 'K-12').value).toBe('K-12');
	});

	it('zeigt bei ungültiger Frist keinen Kündigungstag', () => {
		oeffne();
		tippe('v_ende', '2026-12-31');
		tippe('v_frist', 'drei');
		expect(abschnitt().textContent).not.toContain('Kündigen bis');
	});
});
