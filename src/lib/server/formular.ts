import { ABBUCHUNGSARTEN, ARTEN, type Abbuchungsart, type Art } from '#lib/rechnung/fixkosten.ts';
import { parseDatum } from '#lib/rechnung/datum.ts';
import { leseBetrag, leseGanzzahl } from '#lib/eingabe.ts';
import type { Besitzer } from './db.ts';
import type { GespeicherteBeteiligung, PostenEintrag } from './repo.ts';

export type Fehler = Record<string, string>;

const text = (f: FormData, name: string) => String(f.get(name) ?? '').trim();

function gueltigesDatum(s: string) {
	try {
		parseDatum(s);
		return true;
	} catch {
		return false;
	}
}

export function lesePosten(f: FormData, besitzer: Besitzer): { eintrag: PostenEintrag } | { fehler: Fehler } {
	const fehler: Fehler = {};
	const name = text(f, 'name');
	const betragCent = leseBetrag(text(f, 'betrag'));
	const intervallMonate = leseGanzzahl(text(f, 'intervall'));
	const buchungsdatum = text(f, 'buchungsdatum');
	const art = text(f, 'art');
	const abbuchungsart = text(f, 'abbuchungsart');
	const idText = text(f, 'id');

	if (!name) fehler.name = 'Gib dem Posten einen Namen, zum Beispiel „Netflix“.';
	if (betragCent == null) fehler.betrag = 'Bitte einen Betrag eintragen, zum Beispiel 12,99.';
	else if (betragCent <= 0) fehler.betrag = 'Der Betrag muss größer als 0 sein. Anteile anderer trägst du unten ein.';
	if (!intervallMonate || intervallMonate < 1 || intervallMonate > 24) fehler.intervall = 'Bitte wähle, wie oft abgebucht wird.';
	if (buchungsdatum && !gueltigesDatum(buchungsdatum)) fehler.buchungsdatum = 'Dieses Datum gibt es nicht.';

	const namen = f.getAll('bet_name').map(String);
	const betraege = f.getAll('bet_betrag').map(String);
	const tage = f.getAll('bet_tag').map(String);
	const beteiligungen: GespeicherteBeteiligung[] = [];
	namen.forEach((n, i) => {
		const bName = n.trim();
		const bBetrag = leseBetrag(betraege[i]);
		const bTag = leseGanzzahl(tage[i]);
		if (!bName && bBetrag == null) return;
		if (!bName) fehler[`bet_${i}`] = 'Wer zahlt den Anteil? Bitte einen Namen eintragen.';
		else if (bBetrag == null || bBetrag <= 0) fehler[`bet_${i}`] = `Bitte den Betrag eintragen, den ${bName} zahlt.`;
		else if (bTag != null && (bTag < 1 || bTag > 31)) fehler[`bet_${i}`] = 'Der Tag muss zwischen 1 und 31 liegen.';
		else beteiligungen.push({ name: bName, betragCent: bBetrag, eingangstag: bTag });
	});

	if (Object.keys(fehler).length) return { fehler };
	return {
		eintrag: {
			id: idText ? Number(idText) : undefined,
			besitzer,
			name,
			betragCent: betragCent!,
			intervallMonate: intervallMonate!,
			buchungsdatum: buchungsdatum || null,
			art: (ARTEN as readonly string[]).includes(art) ? (art as Art) : null,
			abbuchungsart: (ABBUCHUNGSARTEN as readonly string[]).includes(abbuchungsart)
				? (abbuchungsart as Abbuchungsart)
				: null,
			beteiligungen
		}
	};
}
