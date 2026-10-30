import { istPostenIcon } from '#lib/postenIcons.ts';
import { ABBUCHUNGSARTEN, ARTEN, type Abbuchungsart, type Art } from '#lib/rechnung/fixkosten.ts';
import { parseDatum } from '#lib/rechnung/datum.ts';
import { leseBetrag, leseGanzzahl } from '#lib/eingabe.ts';
import type { AuftragKonfig, Baustein } from '#lib/rechnung/aufstellung.ts';
import { SCHRITTE, type Rundung } from '#lib/rechnung/rundung.ts';
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
	const icon = text(f, 'icon');

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
			icon: istPostenIcon(icon) ? icon : null,
			beteiligungen
		}
	};
}

// ---------- Daueraufträge ----------

type Roh = Record<string, unknown>;
const RICHTUNGEN = ['auf', 'ab', 'kaufm'] as const;

/** Ziel eines „Rücklagen mit Ziel“-Bausteins: getrimmt, eine WKN in Großbuchstaben wie bei den Rückstellungen. */
export function normalisiereZiel(ziel: string): string {
	const z = ziel.trim();
	return /^(?=.*\d)[a-z0-9]{6}$/i.test(z) ? z.toUpperCase() : z;
}

function pruefeBaustein(b: Roh): Baustein | null {
	switch (b?.typ) {
		case 'fest':
			return Number.isInteger(b.betragCent) && (b.betragCent as number) >= 0 ? { typ: 'fest', betragCent: b.betragCent as number } : null;
		case 'prozent': {
			const p = b.prozent;
			return typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 100 ? { typ: 'prozent', prozent: p } : null;
		}
		case 'ruecklagen':
			return typeof b.ziel === 'string' ? { typ: 'ruecklagen', ziel: normalisiereZiel(b.ziel) } : null;
		case 'gemeinschaft':
		case 'fixkosten':
		case 'rest':
			return { typ: b.typ };
		default:
			return null;
	}
}

function pruefeRundung(r: unknown): Rundung | null | undefined {
	if (r == null) return null;
	const { schritt, richtung } = r as Roh;
	if (!(SCHRITTE as readonly number[]).includes(schritt as number) || !RICHTUNGEN.includes(richtung as (typeof RICHTUNGEN)[number])) {
		return undefined;
	}
	return { schritt: schritt as number, richtung: richtung as Rundung['richtung'] };
}

/**
 * Prüft Daueraufträge in der gespeicherten Form, aus dem Formular wie aus einer Sicherung.
 * Fehler je Auftrag unter `a_<index>`, übergreifende unter `allgemein`.
 */
export function pruefeAuftraege(roh: unknown): { auftraege: AuftragKonfig[] } | { fehler: Record<string, string> } {
	if (!Array.isArray(roh)) return { fehler: { allgemein: 'Die Daueraufträge ließen sich nicht lesen.' } };
	const fehler: Record<string, string> = {};
	const auftraege: AuftragKonfig[] = [];
	roh.forEach((a: Roh, i) => {
		const name = typeof a?.name === 'string' ? a.name.trim() : '';
		if (!name) return void (fehler[`a_${i}`] = 'Bitte einen Namen eintragen, zum Beispiel „ETF Invest“.');
		if (!Array.isArray(a.bausteine) || !a.bausteine.length) {
			return void (fehler[`a_${i}`] = `„${name}“: Woraus setzt sich der Betrag zusammen?`);
		}
		const bausteine: Baustein[] = [];
		for (const roherBaustein of a.bausteine as Roh[]) {
			const b = pruefeBaustein(roherBaustein);
			if (!b) return void (fehler[`a_${i}`] = `„${name}“: Ein Baustein ist ungültig oder unvollständig.`);
			bausteine.push(b);
		}
		if (bausteine.some((b) => b.typ === 'rest') && bausteine.length > 1) {
			return void (fehler[`a_${i}`] = `„${name}“: „Was übrig bleibt“ lässt sich nicht mit anderem kombinieren.`);
		}
		const rundung = pruefeRundung(a.rundung);
		if (rundung === undefined) return void (fehler[`a_${i}`] = `„${name}“: Die Rundung ist ungültig.`);
		if (a.zielkonto != null && typeof a.zielkonto !== 'string') return void (fehler[`a_${i}`] = `„${name}“: Das Zielkonto ist ungültig.`);
		auftraege.push({ name, zielkonto: ((a.zielkonto as string | undefined) ?? '').trim(), bausteine, rundung });
	});
	const gesehen = new Set<string>();
	auftraege.forEach((a) => {
		const schluessel = a.name.toLocaleLowerCase('de-DE');
		// Terminpläne in Actual werden über den Namen zugeordnet, darum muss er eindeutig sein.
		if (gesehen.has(schluessel)) fehler.allgemein = `Der Name „${a.name}“ kommt doppelt vor. Jeder Dauerauftrag braucht einen eigenen Namen.`;
		gesehen.add(schluessel);
	});
	if (auftraege.filter((a) => a.bausteine.some((b) => b.typ === 'rest')).length > 1) {
		fehler.allgemein = 'Nur ein Dauerauftrag kann bekommen, was übrig bleibt.';
	}
	return Object.keys(fehler).length ? { fehler } : { auftraege };
}

/** Liest die Daueraufträge aus dem Formular (Beträge als Text) und prüft sie. */
export function leseAuftraege(roh: unknown): { auftraege: AuftragKonfig[] } | { fehler: Record<string, string> } {
	if (!Array.isArray(roh)) return { fehler: { allgemein: 'Die Eingaben ließen sich nicht lesen.' } };
	const fehler: Record<string, string> = {};
	const umgewandelt = roh.map((a: Roh, i) => {
		const name = String(a?.name ?? '').trim();
		const bausteine = (Array.isArray(a?.bausteine) ? a.bausteine : []).map((b: Roh) => {
			const wert = String(b?.wert ?? '');
			switch (b?.typ) {
				case 'fest': {
					const cent = leseBetrag(wert);
					if (cent == null || cent < 0) fehler[`a_${i}`] = `„${name}“: Bitte einen Betrag eintragen.`;
					return { typ: 'fest', betragCent: cent };
				}
				case 'prozent': {
					const p = Number(wert.replace(',', '.'));
					if (!wert.trim() || !Number.isFinite(p) || p < 0 || p > 100) fehler[`a_${i}`] = `„${name}“: Prozent zwischen 0 und 100 eintragen.`;
					return { typ: 'prozent', prozent: p };
				}
				case 'ruecklagen':
					return { typ: 'ruecklagen', ziel: wert };
				default:
					return { typ: b?.typ };
			}
		});
		const r = a?.rundung as Roh | undefined;
		const schritt = Number(r?.schritt ?? 1);
		const richtung = String(r?.richtung ?? 'kaufm');
		const istRest = bausteine[0]?.typ === 'rest';
		return {
			name,
			zielkonto: String(a?.zielkonto ?? ''),
			bausteine,
			// Beim Rest bedeutet „centgenau“ etwas anderes als „keine Angabe“ (dann auf 1 € abrunden).
			rundung: schritt > 1 || istRest ? { schritt, richtung } : null
		};
	});
	if (Object.keys(fehler).length) return { fehler };
	return pruefeAuftraege(umgewandelt);
}
