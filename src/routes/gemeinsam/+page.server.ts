import { fail } from '@sveltejs/kit';
import { heute } from '#lib/rechnung/datum.ts';
import { leseBetrag, leseGanzzahl } from '#lib/eingabe.ts';
import { SCHRITTE, rundungText } from '#lib/rechnung/rundung.ts';
import type { Schnappschuss } from '#lib/server/actualAbgleich.ts';
import { angemeldet, postenAktionen } from '#lib/server/aktionen.ts';
import { gemeinschaftAnsicht, postenMitZeilen } from '#lib/server/ansicht.ts';
import {
	aendereGemeinschaft,
	ladeActualStand,
	ladeGemeinschaft,
	ladePersonen,
	letzteAenderung,
	type PositionEintrag
} from '#lib/server/repo.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const ich = angemeldet(locals);
	const stichtag = heute();
	const ansicht = gemeinschaftAnsicht(stichtag);
	return {
		...ansicht,
		personen: ladePersonen().map((p) => ({ id: p.id, name: p.name })),
		eintraege: postenMitZeilen(ansicht.posten, stichtag, 1),
		letzte: letzteAenderung('gemeinsam'),
		ich,
		// Ausgaben-Kategorien aus dem letzten Actual-Abruf, für die Prüfung der Aufteilung.
		kategorien: (ladeActualStand<Schnappschuss>(ich)?.daten.kategorien ?? []).filter((k) => !k.einnahme)
	};
};

export const actions: Actions = {
	...postenAktionen(() => 'gemeinsam'),
	modell: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const modell = (await request.formData()).get('modell');
		if (modell !== 'A' && modell !== 'B') return fail(400, { fehler: { modell: 'Bitte wähle eine Aufteilung.' } });
		const undoId = aendereGemeinschaft({ modell }, wer, 'Aufteilung geändert');
		return { meldung: modell === 'A' ? 'Ihr teilt jetzt nach Gehalt auf.' : 'Ihr teilt jetzt so auf, dass beiden gleich viel bleibt.', undoId };
	},
	positionen: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const f = await request.formData();
		const alle = (n: string) => f.getAll(n).map(String);
		const [ids, namen, arten, betraege, ausgaenge, ziele, tage, kategorien] = [
			'pos_id', 'pos_name', 'pos_art', 'pos_betrag', 'pos_ausgang', 'pos_ziel', 'pos_tag', 'pos_kat'
		].map(alle);
		const bisher = new Map(ladeGemeinschaft().positionen.map((p) => [String(p.id), p]));
		const fehler: Record<string, string> = {};
		const positionen: PositionEintrag[] = [];
		namen.forEach((n, i) => {
			const name = n.trim();
			const art = arten[i] === 'fixkosten' ? 'fixkosten' : 'fest';
			const betragCent = art === 'fixkosten' ? 0 : leseBetrag(betraege[i] || '0');
			const tag = tage[i] ? leseGanzzahl(tage[i]) : null;
			if (!name) return void (fehler[`pos_${i}`] = 'Bitte einen Namen eintragen, zum Beispiel „Miete“.');
			if (betragCent == null || betragCent < 0) return void (fehler[`pos_${i}`] = `Bitte den Monatsbetrag für „${name}“ eintragen.`);
			if (tag != null && (tag < 1 || tag > 31)) return void (fehler[`pos_${i}`] = 'Der Tag muss zwischen 1 und 31 liegen.');
			const ausgangArt = ausgaenge[i];
			const vorher = bisher.get(ids[i]);
			const kategorie = { a: vorher?.kategorie.a ?? null, b: vorher?.kategorie.b ?? null };
			kategorie[wer] = kategorien[i] || null;
			positionen.push({
				name,
				art,
				betragCent,
				ausgang:
					ausgangArt === 'ueberweisung' || ausgangArt === 'umbuchung'
						? { art: ausgangArt, ziel: (ziele[i] ?? '').trim(), tag }
						: null,
				kategorie
			});
		});
		if (positionen.filter((p) => p.art === 'fixkosten').length > 1) {
			fehler.allgemein = 'Nur eine Position kann aus den gemeinsamen Fixkosten berechnet werden.';
		}
		if (Object.keys(fehler).length) return fail(400, { fehler });
		const undoId = aendereGemeinschaft({ positionen }, wer, 'Positionen des Gemeinschaftskontos geändert');
		return { meldung: 'Gespeichert.', undoId };
	},

	rundung: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const f = await request.formData();
		const schritt = Number(f.get('schritt'));
		const richtung = String(f.get('richtung'));
		if (!(SCHRITTE as readonly number[]).includes(schritt) || !['auf', 'ab', 'kaufm'].includes(richtung)) {
			return fail(400, { fehler: { rundung: 'Bitte eine Rundung wählen.' } });
		}
		const rundung = { schritt, richtung: richtung as 'auf' | 'ab' | 'kaufm' };
		const undoId = aendereGemeinschaft({ rundung }, wer, `Anteile werden ${rundungText(rundung)}`);
		return { meldung: `Anteile werden jetzt ${rundungText(rundung)}.`, undoId };
	}
};
