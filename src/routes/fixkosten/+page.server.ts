import { heute } from '#lib/rechnung/datum.ts';
import { angemeldet, postenAktionen } from '#lib/server/aktionen.ts';
import { postenMitZeilen } from '#lib/server/ansicht.ts';
import { ladePerson, ladePosten, letzteAenderung } from '#lib/server/repo.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const id = angemeldet(locals);
	const person = ladePerson(id);
	return {
		person,
		eintraege: postenMitZeilen(ladePosten(id), heute(), person.ueberweisungstag),
		letzte: letzteAenderung(`fixkosten-${id}`)
	};
};

export const actions: Actions = postenAktionen((person) => person);
