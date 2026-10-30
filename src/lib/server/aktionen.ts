import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { Besitzer, PersonId } from './db.ts';
import { lesePosten } from './formular.ts';
import { ladeEinzelposten, loeschePosten, speicherePosten } from './repo.ts';

export function angemeldet(locals: App.Locals): PersonId {
	if (!locals.person) error(401, 'Bitte zuerst auswählen, wer du bist.');
	return locals.person;
}

/** Speichern und Löschen von Posten, gemeinsam genutzt von „Fixkosten“ und „Gemeinsam“. */
export function postenAktionen(besitzerVon: (person: PersonId) => Besitzer) {
	return {
		speichern: async ({ request, locals }: RequestEvent) => {
			const wer = angemeldet(locals);
			const ergebnis = lesePosten(await request.formData(), besitzerVon(wer));
			if ('fehler' in ergebnis) return fail(400, { fehler: ergebnis.fehler });
			const eintrag = ergebnis.eintrag;
			const vorher = eintrag.id != null ? ladeEinzelposten(eintrag.id) : null;
			if (vorher?.actualTerminplan) {
				// Diese Werte pflegt Actual, die App ändert sie nicht.
				eintrag.actualTerminplan = vorher.actualTerminplan;
				eintrag.name = vorher.name;
				eintrag.betragCent = vorher.betragCent;
				eintrag.intervallMonate = vorher.intervallMonate;
				eintrag.buchungsdatum = vorher.buchungsdatum;
			}
			const { undoId, text } = speicherePosten(eintrag, wer);
			return { meldung: `${text}.`, undoId };
		},
		loeschen: async ({ request, locals }: RequestEvent) => {
			const wer = angemeldet(locals);
			const id = Number((await request.formData()).get('id'));
			const posten = ladeEinzelposten(id);
			if (!posten || posten.besitzer !== besitzerVon(wer)) return fail(404, { fehler: { allgemein: 'Diesen Posten gibt es nicht mehr.' } });
			const r = loeschePosten(id, wer);
			return { meldung: `${r!.text}.`, undoId: r!.undoId };
		}
	};
}
