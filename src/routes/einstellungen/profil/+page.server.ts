import { fail } from '@sveltejs/kit';
import { leseBetrag, leseGanzzahl } from '#lib/eingabe.ts';
import { angemeldet } from '#lib/server/aktionen.ts';
import { aenderePerson, ladePerson } from '#lib/server/repo.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({ person: ladePerson(angemeldet(locals)) });

export const actions: Actions = {
	profil: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const f = await request.formData();
		const name = String(f.get('name') ?? '').trim();
		const nettoCent = leseBetrag(String(f.get('netto') ?? ''));
		const ueberweisungstag = leseGanzzahl(String(f.get('tag') ?? ''));
		const pufferCent = leseBetrag(String(f.get('puffer') ?? '') || '0');
		const fehler: Record<string, string> = {};
		if (!name) fehler.name = 'Wie heißt du? Der Name erscheint oben in der Auswahl.';
		if (nettoCent == null || nettoCent < 0) fehler.netto = 'Bitte dein Nettogehalt in Euro eintragen, zum Beispiel 3450.';
		if (!ueberweisungstag || ueberweisungstag < 1 || ueberweisungstag > 28) fehler.tag = 'Bitte einen Tag zwischen 1 und 28 eintragen.';
		if (pufferCent == null || pufferCent < 0) fehler.puffer = 'Bitte einen Betrag in Euro eintragen, zum Beispiel 25.';
		if (Object.keys(fehler).length) return fail(400, { bereich: 'profil', fehler });
		const undoId = aenderePerson(
			wer,
			{ name, nettoCent: nettoCent!, ueberweisungstag: ueberweisungstag!, pufferCent: pufferCent! },
			wer,
			'Gehalt und Sparen geändert'
		);
		return { meldung: 'Gespeichert.', undoId };
	},
};
