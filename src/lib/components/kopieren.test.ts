import { afterEach, describe, expect, it, vi } from 'vitest';
import { kopiere } from '#lib/kopieren.ts';

afterEach(() => vi.restoreAllMocks());

describe('kopiere', () => {
	it('ohne sichere Verbindung über ein Textfeld, genau mit dem Text', async () => {
		let kopiert: string | null = null;
		// jsdom kennt execCommand nicht; wie der Browser kopiert es die Auswahl im Textfeld.
		document.execCommand = vi.fn(() => {
			kopiert = (document.activeElement as HTMLTextAreaElement | null)?.value ?? document.querySelector('textarea')!.value;
			return true;
		});
		expect(await kopiere('#template schedule Netflix\n#template 150')).toBe(true);
		expect(kopiert).toBe('#template schedule Netflix\n#template 150');
		expect(document.querySelector('textarea')).toBeNull();
	});

	it('meldet, wenn es nicht geklappt hat', async () => {
		document.execCommand = vi.fn(() => false);
		expect(await kopiere('x')).toBe(false);
	});
});
