import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	waehlen: async ({ request, cookies, url }) => {
		const person = (await request.formData()).get('person');
		if (person !== 'a' && person !== 'b') return fail(400, { fehler: 'Bitte wähle eine Person.' });
		cookies.set('person', person, {
			path: '/',
			maxAge: 60 * 60 * 24 * 400,
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:'
		});
		const ziel = request.headers.get('referer');
		redirect(303, ziel && new URL(ziel).pathname !== '/wer' ? new URL(ziel).pathname : '/');
	}
};
