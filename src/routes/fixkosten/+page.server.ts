import { heute } from '#lib/rechnung/datum.ts';
import { mitMeldungen } from '#lib/rechnung/terminplan.ts';
import { angemeldet, hinweisAktionen, postenAktionen } from '#lib/server/aktionen.ts';
import { warnungenFuer } from '#lib/server/actualAbgleich.ts';
import { postenMitZeilen } from '#lib/server/ansicht.ts';
import { ladePerson, ladePosten, letzteAenderung } from '#lib/server/repo.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const id = angemeldet(locals);
	const person = ladePerson(id);
	return {
		person,
		// Dieselben Meldungen wie unter Einstellungen, am Posten mit dem Terminplan.
		eintraege: postenMitZeilen(mitMeldungen(ladePosten(id), warnungenFuer(id)), heute(), person.ueberweisungstag),
		letzte: letzteAenderung(`fixkosten-${id}`)
	};
};

export const actions: Actions = { ...postenAktionen((person) => person), ...hinweisAktionen };
