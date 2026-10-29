import { fail } from '@sveltejs/kit';
import { leseBetrag, leseGanzzahl, leseProzent } from '#lib/eingabe.ts';
import { angemeldet } from '#lib/server/aktionen.ts';
import {
	aenderePerson,
	importiere,
	ladePerson,
	ladePersonen,
	ladeRueckstellungen,
	letzteAenderungen,
	speichereRueckstellungen,
	type Hell,
	type RueckstellungEintrag,
	type Sicherung
} from '#lib/server/repo.ts';
import { THEMES } from '#lib/themes.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const id = angemeldet(locals);
	return {
		person: ladePerson(id),
		rueckstellungen: ladeRueckstellungen(id),
		verlauf: letzteAenderungen(15),
		namen: Object.fromEntries(ladePersonen().map((p) => [p.id, p.name]))
	};
};

export const actions: Actions = {
	modus: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const modus = Number((await request.formData()).get('modus'));
		if (modus !== 1 && modus !== 2) return fail(400, { bereich: 'modus', fehler: { modus: 'Bitte wähle ein Kontenmodell.' } });
		const undoId = aenderePerson(wer, { modus }, wer, 'Kontenmodell geändert');
		return { meldung: 'Kontenmodell geändert.', undoId };
	},

	profil: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const f = await request.formData();
		const name = String(f.get('name') ?? '').trim();
		const nettoCent = leseBetrag(String(f.get('netto') ?? ''));
		const etfProzent = leseProzent(String(f.get('etf') ?? '') || '0');
		const ueberweisungstag = leseGanzzahl(String(f.get('tag') ?? ''));
		const pufferCent = leseBetrag(String(f.get('puffer') ?? '') || '0');
		const fehler: Record<string, string> = {};
		if (!name) fehler.name = 'Wie heißt du? Der Name erscheint oben in der Auswahl.';
		if (nettoCent == null || nettoCent < 0) fehler.netto = 'Bitte dein Nettogehalt in Euro eintragen, zum Beispiel 3450.';
		if (etfProzent == null || etfProzent < 0 || etfProzent > 100) fehler.etf = 'Bitte eine Zahl zwischen 0 und 100 eintragen.';
		if (!ueberweisungstag || ueberweisungstag < 1 || ueberweisungstag > 28) fehler.tag = 'Bitte einen Tag zwischen 1 und 28 eintragen.';
		if (pufferCent == null || pufferCent < 0) fehler.puffer = 'Bitte einen Betrag in Euro eintragen, zum Beispiel 25.';
		if (Object.keys(fehler).length) return fail(400, { bereich: 'profil', fehler });
		const undoId = aenderePerson(
			wer,
			{ name, nettoCent: nettoCent!, etfProzent: etfProzent!, ueberweisungstag: ueberweisungstag!, pufferCent: pufferCent! },
			wer,
			'Gehalt und Sparen geändert'
		);
		return { meldung: 'Gespeichert.', undoId };
	},

	rueckstellungen: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const f = await request.formData();
		const namen = f.getAll('r_name').map(String);
		const betraege = f.getAll('r_betrag').map(String);
		const ziele = f.getAll('r_ziel').map(String);
		const fehler: Record<string, string> = {};
		const liste: RueckstellungEintrag[] = [];
		namen.forEach((n, i) => {
			const name = n.trim();
			const betragCent = leseBetrag(betraege[i]);
			if (!name && betragCent == null) return;
			if (!name) fehler[`r_${i}`] = 'Wofür legst du das Geld zurück?';
			else if (betragCent == null || betragCent < 0) fehler[`r_${i}`] = `Bitte den Monatsbetrag für „${name}“ eintragen.`;
			else liste.push({ person: wer, name, betragCent, zielkonto: ziele[i]?.trim() || null });
		});
		if (Object.keys(fehler).length) return fail(400, { bereich: 'rueckstellungen', fehler });
		const undoId = speichereRueckstellungen(wer, liste, wer);
		return { meldung: 'Rücklagen gespeichert.', undoId };
	},

	darstellung: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const f = await request.formData();
		const theme = String(f.get('theme') ?? '');
		const hell = String(f.get('hell') ?? '') as Hell;
		if (!THEMES[theme] || !['auto', 'light', 'dark'].includes(hell)) return fail(400, { bereich: 'darstellung', fehler: {} });
		aenderePerson(wer, { theme, hell }, wer, 'Darstellung geändert');
		return {};
	},

	import: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const datei = (await request.formData()).get('datei');
		if (!(datei instanceof File) || datei.size === 0) {
			return fail(400, { bereich: 'import', fehler: { datei: 'Bitte wähle eine Sicherungsdatei aus.' } });
		}
		try {
			importiere(JSON.parse(await datei.text()) as Sicherung, wer);
		} catch (e) {
			const text = e instanceof SyntaxError ? 'Die Datei ist keine gültige Sicherung.' : (e as Error).message;
			return fail(400, { bereich: 'import', fehler: { datei: text } });
		}
		return { meldung: 'Sicherung eingespielt.' };
	}
};
