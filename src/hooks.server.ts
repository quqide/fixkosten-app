import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { DatenordnerFehler, type PersonId } from '#lib/server/db.ts';
import { ladePerson } from '#lib/server/repo.ts';
import { STANDARD_THEME, THEMES } from '#lib/themes.ts';

/**
 * Person aus einem Header der Anmeldung (z. B. AUTH_HEADER=X-authentik-username),
 * sonst aus dem Cookie der Personenauswahl.
 */
function ermittlePerson(headers: Headers): PersonId | null {
	const header = process.env.AUTH_HEADER;
	if (!header) return null;
	const benutzer = headers.get(header);
	if (!benutzer) return null;
	if (benutzer === process.env.PERSON_A_USER) return 'a';
	if (benutzer === process.env.PERSON_B_USER) return 'b';
	return null;
}

export const handle: Handle = async ({ event, resolve }) => {
	const ausAnmeldung = ermittlePerson(event.request.headers);
	const cookie = event.cookies.get('person');
	event.locals.person = ausAnmeldung ?? (cookie === 'a' || cookie === 'b' ? cookie : null);
	event.locals.festePerson = ausAnmeldung != null;

	if (event.url.pathname.startsWith('/api/health')) return resolve(event);

	const person = event.locals.person ? ladePerson(event.locals.person) : null;
	const palette = person && THEMES[person.theme] ? person.theme : STANDARD_THEME;
	const hell = person && person.hell !== 'auto' ? ` data-theme="${person.hell}"` : '';

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('<html lang="de">', `<html lang="de" data-palette="${palette}"${hell}>`)
	});
};

export const handleError: HandleServerError = ({ error }) => {
	console.error(error);
	// Einrichtungsfehler zeigen wir an, damit man sie ohne Container-Log beheben kann.
	if (error instanceof DatenordnerFehler) return { message: error.message };
	return { message: 'Da ist etwas schiefgelaufen. Details stehen im Container-Log.' };
};
