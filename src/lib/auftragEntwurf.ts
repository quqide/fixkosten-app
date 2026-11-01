/**
 * Daueraufträge als Entwurf fürs Bearbeitungsfenster: Beträge als Text, wie sie im Formular stehen.
 * Die Action `auftraege` liest genau diese Form (`leseAuftraege`) und prüft sie.
 */
import { leseBetrag } from '#lib/eingabe.ts';
import { beschreibeAuftrag, type AuftragKonfig, type Baustein } from '#lib/rechnung/aufstellung.ts';
import { rundungText, type Rundung } from '#lib/rechnung/rundung.ts';

export const TEILE = [
	{ typ: 'prozent', name: 'Prozent vom Netto' },
	{ typ: 'fest', name: 'Fester Betrag' },
	{ typ: 'gemeinschaft', name: 'Anteil Gemeinschaftskonto' },
	{ typ: 'ruecklagen', name: 'Rücklagen mit Ziel' },
	{ typ: 'fixkosten', name: 'Rate für Fixkosten' },
	{ typ: 'rest', name: 'Was übrig bleibt' }
] as const;

export type TeilTyp = (typeof TEILE)[number]['typ'];
export type TeilEntwurf = { typ: TeilTyp; wert: string };
export type AuftragEntwurf = { name: string; zielkonto: string; bausteine: TeilEntwurf[]; rundung: Rundung };

const istRest = (bausteine: { typ: string }[]) => bausteine.some((b) => b.typ === 'rest');

/** Ohne gespeicherte Rundung: Rest auf 1 € abrunden (wie die Rechnung), sonst centgenau. */
const standardRundung = (bausteine: { typ: string }[]): Rundung =>
	istRest(bausteine) ? { schritt: 100, richtung: 'ab' } : { schritt: 1, richtung: 'kaufm' };

export function zuEntwurf(a: AuftragKonfig): AuftragEntwurf {
	return {
		name: a.name,
		zielkonto: a.zielkonto,
		bausteine: a.bausteine.map((b) => ({
			typ: b.typ,
			wert:
				b.typ === 'fest'
					? (b.betragCent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, useGrouping: false })
					: b.typ === 'prozent'
						? b.prozent.toLocaleString('de-DE')
						: b.typ === 'ruecklagen'
							? b.ziel
							: ''
		})),
		rundung: { ...(a.rundung ?? standardRundung(a.bausteine)) }
	};
}

export const neuerEntwurf = (): AuftragEntwurf => ({
	name: '',
	zielkonto: '',
	bausteine: [{ typ: 'prozent', wert: '' }],
	rundung: { schritt: 1, richtung: 'kaufm' }
});

/** Für Vorschau und Klartext: Unfertiges zählt als 0, die eigentliche Prüfung macht der Server. */
export function ausEntwurf(e: AuftragEntwurf): AuftragKonfig {
	const bausteine = e.bausteine.map((b): Baustein => {
		switch (b.typ) {
			case 'fest':
				return { typ: 'fest', betragCent: Math.max(0, leseBetrag(b.wert) ?? 0) };
			case 'prozent': {
				const p = Number(b.wert.replace(',', '.'));
				return { typ: 'prozent', prozent: Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 0 };
			}
			case 'ruecklagen':
				return { typ: 'ruecklagen', ziel: b.wert };
			default:
				return { typ: b.typ };
		}
	});
	return {
		name: e.name.trim(),
		zielkonto: e.zielkonto.trim(),
		bausteine,
		rundung: e.rundung.schritt > 1 || istRest(bausteine) ? e.rundung : null
	};
}

/** „20 % vom Netto aufs Depot, auf 1 € gerundet“ */
export function klartext(a: AuftragKonfig): string {
	const formel = beschreibeAuftrag({ ...a, rundung: null });
	const ziel = a.zielkonto ? ` aufs ${a.zielkonto}` : '';
	const rundung = a.rundung && a.rundung.schritt > 1 ? `, ${rundungText(a.rundung)}` : '';
	return formel + ziel + rundung;
}
