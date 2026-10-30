import { istPostenIcon } from '#lib/postenIcons.ts';
import { ABBUCHUNGSARTEN, ARTEN, type Abbuchungsart, type Art } from '#lib/rechnung/fixkosten.ts';
import { parseDatum } from '#lib/rechnung/datum.ts';
import { FRIST_EINHEITEN, istLeer, type FristEinheit, type Vertrag } from '#lib/rechnung/vertrag.ts';
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

	const vertrag = leseVertrag(f, fehler);

	if (Object.keys(fehler).length) return { fehler };
	return {
		eintrag: {
			vertrag,
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

// ---------- Vertrag ----------

export const VERTRAG_TEXT_MAX = 200;

/**
 * Prüft Vertragsangaben in gespeicherter Form (z. B. aus einer Sicherung). Fehler: ein Satz je Feld.
 * Leere Angaben ergeben null.
 */
export function pruefeVertrag(roh: unknown): { vertrag: Vertrag | null } | { fehler: Fehler } {
	if (roh == null) return { vertrag: null };
	const fehler: Fehler = {};
	if (typeof roh !== 'object' || Array.isArray(roh)) return { fehler: { vertrag: 'Die Vertragsangaben sind ungültig.' } };
	const r = roh as Record<string, unknown>;
	const ende = r.laufzeitEnde ?? null;
	if (ende !== null && (typeof ende !== 'string' || !gueltigesDatum(ende))) fehler.v_ende = 'Dieses Datum gibt es nicht.';

	let frist: Vertrag['kuendigungsfrist'] = null;
	if (r.kuendigungsfrist != null) {
		const f = r.kuendigungsfrist as Record<string, unknown>;
		if (!Number.isInteger(f.anzahl) || (f.anzahl as number) < 0 || (f.anzahl as number) > 999) {
			fehler.v_frist = 'Die Kündigungsfrist muss eine ganze Zahl ab 0 sein.';
		} else if (!FRIST_EINHEITEN.includes(f.einheit as FristEinheit)) {
			fehler.v_frist = 'Bitte Tage, Wochen oder Monate wählen.';
		} else frist = { anzahl: f.anzahl as number, einheit: f.einheit as FristEinheit };
	}

	const verl = r.verlaengerungMonate ?? null;
	if (verl !== null && (!Number.isInteger(verl) || (verl as number) < 1 || (verl as number) > 120)) {
		fehler.v_verlaengerung = 'Die Verlängerung muss zwischen 1 und 120 Monaten liegen.';
	}
	const texte: Record<'kundennummer' | 'notiz', string | null> = { kundennummer: null, notiz: null };
	for (const feld of ['kundennummer', 'notiz'] as const) {
		const wert = r[feld] ?? null;
		if (wert === null) continue;
		if (typeof wert !== 'string') fehler[`v_${feld}`] = 'Bitte Text eintragen.';
		else if (wert.trim().length > VERTRAG_TEXT_MAX) fehler[`v_${feld}`] = `Höchstens ${VERTRAG_TEXT_MAX} Zeichen.`;
		else texte[feld] = wert.trim() || null;
	}
	if (Object.keys(fehler).length) return { fehler };
	const vertrag: Vertrag = {
		laufzeitEnde: (ende as string | null) || null,
		kuendigungsfrist: frist,
		verlaengerungMonate: verl as number | null,
		...texte
	};
	return { vertrag: istLeer(vertrag) ? null : vertrag };
}

/** Vertragsangaben aus dem Formular des Posten-Dialogs; Fehler landen in `fehler`. */
function leseVertrag(f: FormData, fehler: Fehler): Vertrag | null {
	const zahl = (name: string) => {
		const t = text(f, name);
		if (!t) return null;
		const n = leseGanzzahl(t);
		return n == null ? NaN : n;
	};
	const anzahl = zahl('v_frist');
	const ergebnis = pruefeVertrag({
		laufzeitEnde: text(f, 'v_ende') || null,
		kuendigungsfrist: anzahl == null ? null : { anzahl: Number.isNaN(anzahl) ? -1 : anzahl, einheit: text(f, 'v_einheit') || 'monate' },
		verlaengerungMonate: (() => {
			const n = zahl('v_verlaengerung');
			return n == null ? null : Number.isNaN(n) ? -1 : n;
		})(),
		kundennummer: String(f.get('v_kundennummer') ?? ''),
		notiz: String(f.get('v_notiz') ?? '')
	});
	if ('fehler' in ergebnis) {
		Object.assign(fehler, ergebnis.fehler);
		return null;
	}
	return ergebnis.vertrag;
}

// ---------- Daueraufträge ----------

type Roh = Record<string, unknown>;
const RICHTUNGEN = ['auf', 'ab', 'kaufm'] as const;

/**
 * Ziel eines „Rücklagen mit Ziel“-Bausteins: getrimmt. Passt es (ohne Rücksicht auf Groß- und Kleinschreibung)
 * zur WKN einer Rückstellung, wird es genau so geschrieben wie dort, z. B. „a0rpwh“ → „A0RPWH“.
 */
export function normalisiereZiel(ziel: string, wkns: readonly string[] = []): string {
	const z = ziel.trim();
	return wkns.find((w) => w.toLocaleUpperCase('de-DE') === z.toLocaleUpperCase('de-DE')) ?? z;
}

/** Obergrenzen, damit eine bearbeitete Sicherung keine unsinnigen Werte einspielt. */
export const MAX_BETRAG_CENT = 100_000_000;
export const MAX_NAME = 100;

function pruefeBaustein(b: Roh, wkns: readonly string[]): Baustein | null {
	switch (b?.typ) {
		case 'fest':
			return Number.isInteger(b.betragCent) && (b.betragCent as number) >= 0 && (b.betragCent as number) <= MAX_BETRAG_CENT
				? { typ: 'fest', betragCent: b.betragCent as number }
				: null;
		case 'prozent': {
			const p = b.prozent;
			return typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 100 ? { typ: 'prozent', prozent: p } : null;
		}
		case 'ruecklagen':
			return typeof b.ziel === 'string' && b.ziel.length <= MAX_NAME ? { typ: 'ruecklagen', ziel: normalisiereZiel(b.ziel, wkns) } : null;
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
 * Fehler je Auftrag unter `a_<index>`, übergreifende unter `allgemein`. `wkns`: WKNs der Rückstellungen.
 */
export function pruefeAuftraege(roh: unknown, wkns: readonly string[] = []): { auftraege: AuftragKonfig[] } | { fehler: Record<string, string> } {
	if (!Array.isArray(roh)) return { fehler: { allgemein: 'Die Daueraufträge ließen sich nicht lesen.' } };
	const fehler: Record<string, string> = {};
	const auftraege: AuftragKonfig[] = [];
	roh.forEach((a: Roh, i) => {
		const name = typeof a?.name === 'string' ? a.name.trim() : '';
		if (!name) return void (fehler[`a_${i}`] = 'Bitte einen Namen eintragen, zum Beispiel „ETF Invest“.');
		if (name.length > MAX_NAME) return void (fehler[`a_${i}`] = `Der Name darf höchstens ${MAX_NAME} Zeichen haben.`);
		if (!Array.isArray(a.bausteine) || !a.bausteine.length) {
			return void (fehler[`a_${i}`] = `„${name}“: Woraus setzt sich der Betrag zusammen?`);
		}
		const bausteine: Baustein[] = [];
		for (const roherBaustein of a.bausteine as Roh[]) {
			const b = pruefeBaustein(roherBaustein, wkns);
			if (!b) return void (fehler[`a_${i}`] = `„${name}“: Ein Baustein ist ungültig oder unvollständig.`);
			bausteine.push(b);
		}
		if (bausteine.some((b) => b.typ === 'rest') && bausteine.length > 1) {
			return void (fehler[`a_${i}`] = `„${name}“: „Was übrig bleibt“ lässt sich nicht mit anderem kombinieren.`);
		}
		const rundung = pruefeRundung(a.rundung);
		if (rundung === undefined) return void (fehler[`a_${i}`] = `„${name}“: Die Rundung ist ungültig.`);
		if (a.zielkonto != null && (typeof a.zielkonto !== 'string' || a.zielkonto.length > MAX_NAME)) {
			return void (fehler[`a_${i}`] = `„${name}“: Das Zielkonto ist ungültig.`);
		}
		auftraege.push({ name, zielkonto: ((a.zielkonto as string | undefined) ?? '').trim(), bausteine, rundung });
	});
	const allgemein: string[] = [];
	const gesehen = new Set<string>();
	for (const a of auftraege) {
		const schluessel = a.name.toLocaleLowerCase('de-DE');
		// Terminpläne in Actual werden über den Namen zugeordnet, darum muss er eindeutig sein.
		if (gesehen.has(schluessel)) {
			allgemein.push(`Der Name „${a.name}“ kommt doppelt vor. Jeder Dauerauftrag braucht einen eigenen Namen.`);
			break;
		}
		gesehen.add(schluessel);
	}
	if (auftraege.filter((a) => a.bausteine.some((b) => b.typ === 'rest')).length > 1) {
		allgemein.push('Nur ein Dauerauftrag kann bekommen, was übrig bleibt.');
	}
	if (allgemein.length) fehler.allgemein = allgemein.join(' ');
	return Object.keys(fehler).length ? { fehler } : { auftraege };
}

/** Liest die Daueraufträge aus dem Formular (Beträge als Text) und prüft sie. */
export function leseAuftraege(roh: unknown, wkns: readonly string[] = []): { auftraege: AuftragKonfig[] } | { fehler: Record<string, string> } {
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
	return pruefeAuftraege(umgewandelt, wkns);
}
