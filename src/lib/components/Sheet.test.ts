import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import SheetProbe from './testhilfen/SheetProbe.svelte';

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

function oeffne() {
	const gespeichert = vi.fn();
	app = mount(SheetProbe, { target: document.body, props: { gespeichert } });
	flushSync();
	const ausloeser = document.querySelector<HTMLButtonElement>('#ausloeser')!;
	ausloeser.focus();
	ausloeser.click();
	flushSync();
	return { gespeichert, ausloeser, dialog: document.querySelector('dialog')! };
}

const taste = (key: string, shiftKey = false) => {
	const e = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
	(document.activeElement ?? document.body).dispatchEvent(e);
	flushSync();
	return e;
};
const knopf = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === text)!;

describe('Bearbeitungsfenster', () => {
	it('öffnet modal mit Kopfzeile und Fokus im Fenster', () => {
		const { dialog } = oeffne();
		expect(dialog.open).toBe(true);
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Probe');
		expect([...dialog.querySelectorAll('.sheet-kopf button')].map((b) => b.textContent)).toEqual(['Abbrechen', 'Fertig']);
		expect(document.activeElement).toBe(knopf('Abbrechen'));
	});

	it('Escape schließt ohne zu speichern, der Fokus kehrt zum Auslöser zurück', () => {
		const { dialog, gespeichert, ausloeser } = oeffne();
		expect(taste('Escape').defaultPrevented).toBe(true);
		expect(dialog.open).toBe(false);
		expect(gespeichert).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(ausloeser);
	});

	it('Abbrechen schließt ohne zu speichern', () => {
		const { dialog, gespeichert, ausloeser } = oeffne();
		knopf('Abbrechen').click();
		flushSync();
		expect(dialog.open).toBe(false);
		expect(gespeichert).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(ausloeser);
	});

	it('„Fertig“ schickt das Formular ab und gibt den Fokus zurück', () => {
		const { dialog, gespeichert, ausloeser } = oeffne();
		knopf('Fertig').click();
		flushSync();
		expect(gespeichert).toHaveBeenCalledWith('Netflix');
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(ausloeser);
	});

	it('Tab bleibt im Fenster: vom letzten zum ersten und mit Umschalt zurück', () => {
		oeffne();
		const letzter = document.querySelector<HTMLButtonElement>('#letzter')!;
		letzter.focus();
		expect(taste('Tab').defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(knopf('Abbrechen'));
		taste('Tab', true);
		expect(document.activeElement).toBe(letzter);
		// Felder im zugeklappten Abschnitt zählen nicht: Umschalt+Tab vom ersten springt zum letzten sichtbaren.
		knopf('Abbrechen').focus();
		taste('Tab', true);
		expect(document.activeElement).toBe(letzter);
		document.querySelector('details')!.open = true;
		document.querySelector<HTMLInputElement>('[name="versteckt"]')!.focus();
		expect(taste('Tab').defaultPrevented).toBe(false);
	});

});
