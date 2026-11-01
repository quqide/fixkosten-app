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

function oeffne(vertrag: Vertrag | null = null, extra: Record<string, unknown> = {}) {
	app = mount(PostenDialog, {
		target: document.body,
		props: {
			posten: { name: 'Handy', betragCent: 1000, intervallMonate: 1, buchungsdatum: null, besitzer: 'a', beteiligungen: [], vertrag, ...extra }
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

describe('Posten-Dialog im Bearbeitungsfenster', () => {
	it('„Fertig“ schickt das Posten-Formular ab, Escape schließt ohne Speichern', () => {
		oeffne(null, { id: 7 });
		const fertig = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Fertig')!;
		expect(fertig.type).toBe('submit');
		expect(fertig.form?.getAttribute('action')).toBe('?/speichern');
		expect(document.querySelector('dialog h2')!.textContent).toBe('Handy');
		// Löschen bleibt unten im Fenster.
		expect(document.querySelector('button.danger')!.textContent).toContain('löschen');

		document.querySelector('dialog')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		flushSync();
		expect(document.querySelector('dialog')!.open).toBe(false);
		expect(document.querySelector('form')).toBeNull();
	});
});

it('neuer Posten: Titel „Neue Fixkosten“, kein Löschen', () => {
	oeffne();
	expect(document.querySelector('dialog h2')!.textContent).toBe('Neue Fixkosten');
	expect(document.querySelector('button.danger')).toBeNull();
});
