import { fail } from '@sveltejs/kit';
import { angemeldet } from '#lib/server/aktionen.ts';
import { importiere, type Sicherung } from '#lib/server/repo.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	angemeldet(locals);
	return {};
};

export const actions: Actions = {
	import: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const datei = (await request.formData()).get('datei');
		if (!(datei instanceof File) || datei.size === 0) {
			return fail(400, { bereich: 'import', fehler: { datei: 'Bitte wähle eine Sicherungsdatei aus.' } });
		}
		let umbenannt: string[];
		try {
			umbenannt = importiere(JSON.parse(await datei.text()) as Sicherung, wer).umbenannt;
		} catch (e) {
			const text = e instanceof SyntaxError ? 'Die Datei ist keine gültige Sicherung.' : (e as Error).message;
			return fail(400, { bereich: 'import', fehler: { datei: text } });
		}
		const hinweis = umbenannt.length ? ` Doppelte Namen umbenannt: ${umbenannt.join(', ')}.` : '';
		return { meldung: `Sicherung eingespielt.${hinweis}` };
	}
};
