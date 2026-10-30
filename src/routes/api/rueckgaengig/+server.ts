import { error, json } from '@sveltejs/kit';
import { macheRueckgaengig, NichtMehrRueckgaengig } from '#lib/server/repo.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.person) error(401, 'Bitte zuerst auswählen, wer du bist.');
	const { id } = await request.json();
	try {
		const meldung = macheRueckgaengig(Number(id), locals.person);
		return json({ meldung: meldung ? 'Rückgängig gemacht' : null });
	} catch (e) {
		if (e instanceof NichtMehrRueckgaengig) return json({ meldung: e.message });
		throw e;
	}
};
