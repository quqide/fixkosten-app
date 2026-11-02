import { fail } from '@sveltejs/kit';
import { angemeldet } from '#lib/server/aktionen.ts';
import { aenderePerson, ladePerson, type Hell } from '#lib/server/repo.ts';
import { THEMES } from '#lib/themes.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const p = ladePerson(angemeldet(locals));
	return { theme: p.theme, hell: p.hell };
};

export const actions: Actions = {
	darstellung: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const f = await request.formData();
		const theme = String(f.get('theme') ?? '');
		const hell = String(f.get('hell') ?? '') as Hell;
		if (!Object.hasOwn(THEMES, theme) || !['auto', 'light', 'dark'].includes(hell)) return fail(400, { bereich: 'darstellung', fehler: {} });
		aenderePerson(wer, { theme, hell }, wer, 'Darstellung geändert');
		return {};
	},
};
