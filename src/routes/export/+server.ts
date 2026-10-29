import { error } from '@sveltejs/kit';
import { exportiere } from '#lib/server/repo.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	if (!locals.person) error(401, 'Bitte zuerst auswählen, wer du bist.');
	const datum = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(exportiere(), null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="fixkosten-${datum}.json"`
		}
	});
};
