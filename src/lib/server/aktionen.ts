import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { Besitzer, PersonId } from './db.ts';
import { lesePosten } from './formular.ts';
import { ladeAusblendungen, ladeEinzelposten, loeschePosten, setzeAusblendung, speicherePosten } from './repo.ts';
import { istAusblendbar, leseHinweisSchluessel, type WarnungArt } from '#lib/rechnung/terminplan.ts';
import { warnungenFuer } from './actualAbgleich.ts';

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

/**
 * Hinweise ausblenden und wieder einblenden, genutzt von „Fixkosten“ und „Einstellungen“.
 * Das Formularfeld „hinweis“ enthält hinweisSchluessel(terminplanId, art).
 */
export const hinweisAktionen = {
	ausblenden: async ({ request, locals }: RequestEvent) => {
		const wer = angemeldet(locals);
		const h = leseHinweisSchluessel(String((await request.formData()).get('hinweis') ?? ''));
		// Doppelt abgeschickt (zweiter Tab, langsame Verbindung): einfach nichts tun.
		if (h && istAusgeblendet(wer, h)) return { meldung: 'Der Hinweis ist schon ausgeblendet.' };
		// Nur, was gerade als Hinweis gemeldet wird; Warnungen bleiben immer sichtbar.
		const meldung = h && warnungenFuer(wer).find((w) => w.terminplanId === h.terminplan && w.art === h.art);
		if (!h || !meldung || !istAusblendbar(meldung)) {
			return fail(400, { bereich: 'hinweise', fehler: { allgemein: 'Diese Meldung lässt sich nicht ausblenden.' } });
		}
		const undoId = setzeAusblendung(wer, { terminplan: h.terminplan, art: meldung.art }, true, wer, 'Hinweis ausgeblendet');
		return { meldung: 'Hinweis ausgeblendet.', undoId };
	},
	einblenden: async ({ request, locals }: RequestEvent) => {
		const wer = angemeldet(locals);
		const h = leseHinweisSchluessel(String((await request.formData()).get('hinweis') ?? ''));
		if (!h || !istAusgeblendet(wer, h)) {
			return fail(400, { bereich: 'hinweise', fehler: { allgemein: 'Dieser Hinweis ist nicht ausgeblendet.' } });
		}
		const undoId = setzeAusblendung(wer, { terminplan: h.terminplan, art: h.art as WarnungArt }, false, wer, 'Hinweis wieder eingeblendet');
		return { meldung: 'Hinweis wieder eingeblendet.', undoId };
	}
};

function istAusgeblendet(person: PersonId, h: { terminplan: string; art: string }) {
	return ladeAusblendungen(person).some((x) => x.terminplan === h.terminplan && x.art === h.art);
}
