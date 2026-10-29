import { json } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';

/** Für den Docker-Healthcheck: gesund ist der Container nur mit nutzbarer Datenbank. */
export function GET() {
	try {
		db().prepare('SELECT 1').get();
		return json({ status: 'ok' });
	} catch (e) {
		return json({ status: 'fehler', meldung: (e as Error).message }, { status: 503 });
	}
}
