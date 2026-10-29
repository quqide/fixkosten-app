import { fail } from '@sveltejs/kit';
import { heute } from '#lib/rechnung/datum.ts';
import { leseBetrag } from '#lib/eingabe.ts';
import { angemeldet, postenAktionen } from '#lib/server/aktionen.ts';
import { gemeinschaftAnsicht, postenMitZeilen } from '#lib/server/ansicht.ts';
import { aendereGemeinschaft, ladePersonen, letzteAenderung } from '#lib/server/repo.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	angemeldet(locals);
	const stichtag = heute();
	const ansicht = gemeinschaftAnsicht(stichtag);
	return {
		...ansicht,
		personen: ladePersonen().map((p) => ({ id: p.id, name: p.name })),
		eintraege: postenMitZeilen(ansicht.posten, stichtag, 1),
		letzte: letzteAenderung('gemeinsam')
	};
};

export const actions: Actions = {
	...postenAktionen(() => 'gemeinsam'),
	modell: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const modell = (await request.formData()).get('modell');
		if (modell !== 'A' && modell !== 'B') return fail(400, { fehler: { modell: 'Bitte wähle eine Aufteilung.' } });
		const undoId = aendereGemeinschaft({ modell }, wer, 'Aufteilung geändert');
		return { meldung: modell === 'A' ? 'Ihr teilt jetzt nach Gehalt auf.' : 'Ihr teilt jetzt so auf, dass beiden gleich viel bleibt.', undoId };
	},
	betraege: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const f = await request.formData();
		const werte = {
			mieteCent: leseBetrag(String(f.get('miete') ?? '') || '0'),
			alltagCent: leseBetrag(String(f.get('alltag') ?? '') || '0'),
			ruecklageCent: leseBetrag(String(f.get('ruecklage') ?? '') || '0')
		};
		const fehler: Record<string, string> = {};
		for (const [k, v] of Object.entries(werte)) {
			if (v == null || v < 0) fehler[k] = 'Bitte einen Betrag in Euro eintragen, zum Beispiel 650.';
		}
		if (Object.keys(fehler).length) return fail(400, { fehler });
		const undoId = aendereGemeinschaft(werte as Record<keyof typeof werte, number>, wer, 'Monatliche Beträge geändert');
		return { meldung: 'Beträge gespeichert.', undoId };
	}
};
