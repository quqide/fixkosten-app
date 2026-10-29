import { fail } from '@sveltejs/kit';
import { heute, parseDatum } from '#lib/rechnung/datum.ts';
import { leseBetrag } from '#lib/eingabe.ts';
import { angemeldet } from '#lib/server/aktionen.ts';
import { personAnsicht } from '#lib/server/ansicht.ts';
import { gleicheAb } from '#lib/rechnung/abgleich.ts';
import { ActualFehler, ladeStand } from '#lib/server/actual.ts';
import { aenderePerson, aktualisierePerson, ladePerson, letzteAenderung } from '#lib/server/repo.ts';
import type { Actions, PageServerLoad } from './$types';

function stichtagAus(url: URL) {
	const wunsch = url.searchParams.get('stichtag');
	if (wunsch) {
		try {
			parseDatum(wunsch);
			return { stichtag: wunsch, zeitreise: wunsch !== heute() };
		} catch {
			/* ungültig: heute nehmen */
		}
	}
	return { stichtag: heute(), zeitreise: false };
}

export const load: PageServerLoad = ({ locals, url }) => {
	const id = angemeldet(locals);
	const { stichtag, zeitreise } = stichtagAus(url);
	return {
		stichtag,
		zeitreise,
		...personAnsicht(id, stichtag),
		letzte: letzteAenderung(`fixkosten-${id}`)
	};
};

export const actions: Actions = {
	kontostand: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const f = await request.formData();
		const istCent = leseBetrag(String(f.get('ist') ?? ''));
		if (istCent == null) return fail(400, { fehler: 'Bitte trag den Kontostand ein, zum Beispiel 812,40.' });
		const undoId = aenderePerson(
			wer,
			{
				istCent,
				istDatum: heute(),
				istAusstehend: f.get('ausstehend') === 'on',
				istQuelle: 'hand',
				abgleich: null
			},
			wer,
			'Kontostand eingetragen'
		);
		return { meldung: 'Kontostand gespeichert.', undoId };
	},

	actual: async ({ locals }) => {
		const wer = angemeldet(locals);
		const person = ladePerson(wer);
		if (!person.actualKontoId) {
			return fail(400, { fehler: 'Wähl zuerst unter Einstellungen das Konto in Actual aus.' });
		}
		const stichtag = heute();
		try {
			const stand = await ladeStand(wer, person.actualKontoId, stichtag);
			const { aufstellung } = personAnsicht(wer, stichtag);
			const abgleich = gleicheAb({
				buchungen: stand.buchungen,
				nettoCent: person.nettoCent,
				dauerauftraege: aufstellung.dauerauftraege
			});
			aktualisierePerson(wer, { istCent: stand.saldoCent, istDatum: stichtag, istQuelle: 'actual', abgleich });
			return { meldung: 'Kontostand aus Actual aktualisiert.' };
		} catch (e) {
			if (e instanceof ActualFehler) return fail(502, { fehler: e.message });
			console.error('Actual-Abruf fehlgeschlagen', e);
			return fail(502, { fehler: 'Der Abruf aus Actual hat nicht geklappt. Bitte später noch einmal versuchen.' });
		}
	}
};
