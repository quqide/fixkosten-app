import { angemeldet } from '#lib/server/aktionen.ts';
import { ladePersonen, letzteAenderungen } from '#lib/server/repo.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	angemeldet(locals);
	return {
		verlauf: letzteAenderungen(15),
		namen: Object.fromEntries(ladePersonen().map((p) => [p.id, p.name]))
	};
};
