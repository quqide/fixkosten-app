import { redirect } from '@sveltejs/kit';
import { ladePersonen } from '#lib/server/repo.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.person && url.pathname !== '/wer') redirect(303, '/wer');
	const personen = ladePersonen();
	const ich = personen.find((p) => p.id === locals.person) ?? null;
	return {
		personen: personen.map((p) => ({ id: p.id, name: p.name })),
		ich: ich && { id: ich.id, name: ich.name, theme: ich.theme, hell: ich.hell },
		festePerson: locals.festePerson
	};
};
