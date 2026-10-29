import { invalidateAll } from '$app/navigation';
import type { SubmitFunction } from '$app/forms';

export const toast = $state({ text: '', undoId: null as number | null, sichtbar: false });

let timer: ReturnType<typeof setTimeout> | undefined;

export function zeigeToast(text: string, undoId: number | null = null) {
	toast.text = text;
	toast.undoId = undoId;
	toast.sichtbar = true;
	clearTimeout(timer);
	timer = setTimeout(() => (toast.sichtbar = false), 6000);
}

export async function rueckgaengig() {
	if (toast.undoId == null) return;
	const id = toast.undoId;
	toast.sichtbar = false;
	const antwort = await fetch('/api/rueckgaengig', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ id })
	});
	const { meldung } = await antwort.json();
	await invalidateAll();
	zeigeToast(meldung ?? 'Das ließ sich nicht mehr rückgängig machen.');
}

/** Für use:enhance: Formular abschicken, Seite aktualisieren, Bestätigung mit Rückgängig zeigen. */
export function mitRueckmeldung(nachErfolg?: () => void): SubmitFunction {
	return () =>
		async ({ result, update }) => {
			await update({ reset: false, invalidateAll: true });
			if (result.type === 'success') {
				const daten = result.data as { meldung?: string; undoId?: number } | undefined;
				if (daten?.meldung) zeigeToast(daten.meldung, daten.undoId ?? null);
				nachErfolg?.();
			}
		};
}
