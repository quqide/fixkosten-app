import { json } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';

/** Für den Docker-Healthcheck: gesund ist der Container nur mit nutzbarer Datenbank. */
export function GET() {
	try {
		db().prepare('SELECT 1').get();
		return json({ status: 'ok' });
	} catch (e) {
		// Pfad, Benutzer und Gruppe nur ins Log, nicht in die öffentliche Antwort.
		console.error('Healthcheck fehlgeschlagen:', (e as Error).message);
		return json({ status: 'fehler' }, { status: 503 });
	}
}
