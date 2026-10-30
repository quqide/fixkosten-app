import type { Dauerauftrag } from './aufstellung';
import type { IsoDatum } from './datum';

/** Ein Terminplan aus Actual Budget, auf das reduziert, was die App braucht. Ausgaben positiv. */
export interface Terminplan {
	id: string;
	name: string;
	kontoId: string | null;
	kontoName: string | null;
	empfaenger: string | null;
	/** Umbuchung auf ein anderes Konto in Actual. */
	umbuchung: boolean;
	betragCent: number;
	betragArt: 'fest' | 'ungefaehr' | 'spanne';
	rhythmus: {
		frequenz: 'daily' | 'weekly' | 'monthly' | 'yearly';
		intervall: number;
		/** Sonderregeln wie „letzter Tag im Monat“ oder „jeden 2. Dienstag“. */
		muster: boolean;
	} | null;
	naechsterTermin: IsoDatum | null;
	beendet: boolean;
	kategorieId: string | null;
	/** Letzte Buchung, die Actual mit diesem Terminplan verknüpft hat. */
	letzteBuchung: { datum: IsoDatum; betragCent: number } | null;
	/** Aufteilung (Split) des Terminplans nach Kategorien, falls vorhanden. */
	aufteilung?: { kategorieId: string | null; betragCent: number }[] | null;
}

export type Rolle =
	| { typ: 'fixkosten' }
	| { typ: 'dauerauftrag'; name: string }
	| { typ: 'ignorieren' };

export interface Warnung {
	stufe: 'warnung' | 'hinweis';
	terminplanId: string | null;
	/** Was nicht passt, in einem Satz. */
	text: string;
	/** Was in Actual (oder in der App) zu tun ist. */
	tun: string;
}

/** Intervall in Monaten, oder null, wenn sich der Rhythmus nicht in Monaten ausdrücken lässt. */
export function intervallMonate(t: Terminplan): number | null {
	if (!t.rhythmus) return null;
	const n = Math.max(1, t.rhythmus.intervall);
	if (t.rhythmus.frequenz === 'monthly') return n;
	if (t.rhythmus.frequenz === 'yearly') return 12 * n;
	return null;
}

/** Die Felder eines Fixkostenpostens, die aus Actual kommen. */
export function alsPosten(t: Terminplan) {
	const intervall = intervallMonate(t);
	if (intervall == null || !t.naechsterTermin) return null;
	return {
		name: t.name,
		intervallMonate: intervall,
		betragCent: t.betragCent,
		buchungsdatum: t.naechsterTermin
	};
}

const eur = (cent: number) =>
	(cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

function tageZwischen(von: IsoDatum, bis: IsoDatum) {
	return Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000);
}

export interface PruefungEingaben {
	terminplaene: Terminplan[];
	zuordnung: Map<string, Rolle>;
	/** Das Konto, das die Übersicht zeigt (Gehalts- oder Fixkosten-Konto). */
	kontoId: string | null;
	kontoName: string | null;
	dauerauftraege: Dauerauftrag[];
	gehaltKategorie: string | null;
	/** Datum der letzten Buchung in der Gehaltskategorie, falls bekannt. */
	letztesGehalt: IsoDatum | null;
	/** Posten der App, die mit einem Terminplan verknüpft sind. */
	verknuepft: { name: string; terminplanId: string }[];
	heute: IsoDatum;
	/** Soll-Aufteilung des Dauerauftrags aufs Gemeinschaftskonto: eigener Anteil je Position. */
	gemeinschaft?: { auftrag: string; teile: { name: string; kategorieId: string | null; betragCent: number }[] } | null;
	kategorieName?: (id: string) => string;
}

const ABWEICHUNG_CENT = 100;

/** Weicht eine echte Buchung vom Terminplan ab? Fester Betrag: jeder Cent; „ungefähr“: wie Actual ±7,5 %. */
function weichtAb(t: Terminplan, gebuchtCent: number) {
	const diff = Math.abs(gebuchtCent - t.betragCent);
	if (t.betragArt === 'fest') return diff > 0;
	if (t.betragArt === 'ungefaehr') return diff > Math.abs(t.betragCent) * 0.075;
	return false;
}

/** Prüft die Terminpläne gegen das, was die App für eine gute Einrichtung hält. */
export function pruefeTerminplaene(e: PruefungEingaben): Warnung[] {
	const w: Warnung[] = [];
	const offen = e.terminplaene.filter((t) => !t.beendet);

	const neu = offen.filter((t) => !e.zuordnung.has(t.id) && t.kontoId === e.kontoId);
	if (neu.length) {
		w.push({
			stufe: 'hinweis',
			terminplanId: null,
			text: `${neu.length === 1 ? 'Ein Terminplan ist' : `${neu.length} Terminpläne sind`} noch keiner Rolle zugeordnet.`,
			tun: 'Unter „Terminpläne zuordnen“ festlegen, ob es Fixkosten oder ein Dauerauftrag ist.'
		});
	}

	for (const t of e.terminplaene) {
		const rolle = e.zuordnung.get(t.id);
		if (!rolle || rolle.typ === 'ignorieren') continue;
		const name = `„${t.name}“`;

		if (t.beendet) {
			w.push({
				stufe: 'hinweis',
				terminplanId: t.id,
				text: `${name} ist in Actual beendet.`,
				tun: 'Wenn der Vertrag ausgelaufen ist, den Posten in der App löschen.'
			});
			continue;
		}
		if (intervallMonate(t) == null) {
			w.push({
				stufe: 'warnung',
				terminplanId: t.id,
				text: `${name} wiederholt sich nicht monatlich oder jährlich und lässt sich nicht übernehmen.`,
				tun: 'Rhythmus im Terminplan auf „monatlich“ oder „jährlich“ mit Intervall umstellen.'
			});
		} else if (t.rhythmus?.muster) {
			w.push({
				stufe: 'hinweis',
				terminplanId: t.id,
				text: `${name} nutzt eine Sonderregel für den Tag.`,
				tun: 'Die App rechnet mit dem nächsten Termin aus Actual. Einen festen Tag im Monat einstellen, wenn möglich.'
			});
		}
		if (t.betragArt !== 'fest') {
			w.push({
				stufe: 'hinweis',
				terminplanId: t.id,
				text: `${name} hat keinen festen Betrag. Die App rechnet mit ${eur(t.betragCent)}.`,
				tun: 'Im Terminplan „ist“ statt „ungefähr“ oder „zwischen“ wählen.'
			});
		}
		if (t.kontoId !== e.kontoId && rolle.typ === 'fixkosten') {
			w.push({
				stufe: 'warnung',
				terminplanId: t.id,
				text: `${name} wird von ${t.kontoName ?? 'einem anderen Konto'} abgebucht, nicht von ${e.kontoName ?? 'deinem gewählten Konto'}.`,
				tun: 'Konto im Terminplan korrigieren oder den Terminplan in der App ignorieren.'
			});
		}
		if (t.naechsterTermin && tageZwischen(t.naechsterTermin, e.heute) > 3) {
			w.push({
				stufe: 'warnung',
				terminplanId: t.id,
				text: `${name} war am ${t.naechsterTermin.split('-').reverse().join('.')} fällig, Actual hat aber keine Buchung dazu.`,
				tun: 'Buchung in Actual dem Terminplan zuordnen oder den Termin überspringen.'
			});
		}
		if (rolle.typ === 'fixkosten') {
			if (!t.kategorieId) {
				w.push({
					stufe: 'warnung',
					terminplanId: t.id,
					text: `${name} hat keine Kategorie.`,
					tun: 'Im Terminplan unter Aktionen eine Kategorie setzen.'
				});
			}
			if (t.umbuchung) {
				w.push({
					stufe: 'hinweis',
					terminplanId: t.id,
					text: `${name} ist eine Umbuchung zwischen deinen Konten.`,
					tun: 'Eher als Dauerauftrag zuordnen statt als Fixkosten.'
				});
			}
			if (t.letzteBuchung && weichtAb(t, t.letzteBuchung.betragCent)) {
				w.push({
					stufe: 'warnung',
					terminplanId: t.id,
					text: `${name}: Zuletzt wurden ${eur(t.letzteBuchung.betragCent)} abgebucht, geplant sind ${eur(t.betragCent)}.`,
					tun: 'Preisänderung? Betrag im Terminplan anpassen.'
				});
			}
		} else {
			const auftrag = e.dauerauftraege.find((d) => d.name === rolle.name);
			if (!auftrag) {
				w.push({
					stufe: 'hinweis',
					terminplanId: t.id,
					text: `${name} ist dem Dauerauftrag „${rolle.name}“ zugeordnet, den es nicht mehr gibt.`,
					tun: 'Neu zuordnen.'
				});
			} else if (Math.abs(auftrag.betragCent - t.betragCent) > ABWEICHUNG_CENT) {
				w.push({
					stufe: 'warnung',
					terminplanId: t.id,
					text: `${rolle.name}: In Actual stehen ${eur(t.betragCent)}, berechnet sind ${eur(auftrag.betragCent)}.`,
					tun: `Betrag im Terminplan ${name} auf ${eur(auftrag.betragCent)} ändern.`
				});
			}
		}
	}

	if (e.gemeinschaft && e.gemeinschaft.teile.some((t) => t.kategorieId)) {
		const soll = e.gemeinschaft;
		const plan = e.terminplaene.find((t) => {
			const r = e.zuordnung.get(t.id);
			return !t.beendet && r?.typ === 'dauerauftrag' && r.name === soll.auftrag;
		});
		const kat = (id: string | null) => (id ? (e.kategorieName?.(id) ?? id) : 'ohne Kategorie');
		if (plan && !plan.aufteilung?.length) {
			w.push({
				stufe: 'hinweis',
				terminplanId: plan.id,
				text: `„${plan.name}“ ist nicht nach Kategorien aufgeteilt.`,
				tun: `Im Terminplan aufteilen: ${soll.teile.filter((t) => t.kategorieId).map((t) => `${kat(t.kategorieId)} ${eur(t.betragCent)}`).join(', ')}.`
			});
		} else if (plan?.aufteilung) {
			for (const t of soll.teile) {
				if (!t.kategorieId) continue;
				const ist = plan.aufteilung.filter((a) => a.kategorieId === t.kategorieId).reduce((s, a) => s + a.betragCent, 0);
				if (ist !== t.betragCent) {
					w.push({
						stufe: 'warnung',
						terminplanId: plan.id,
						text: `${soll.auftrag}/${t.name}: In Actual ${eur(ist)}, berechnet ${eur(t.betragCent)}.`,
						tun: `Im Terminplan „${plan.name}“ den Teil für ${kat(t.kategorieId)} auf ${eur(t.betragCent)} setzen.`
					});
				}
			}
			const erwartet = new Set(soll.teile.map((t) => t.kategorieId).filter(Boolean));
			for (const a of plan.aufteilung) {
				if (!erwartet.has(a.kategorieId)) {
					w.push({
						stufe: 'hinweis',
						terminplanId: plan.id,
						text: `„${plan.name}“ hat einen Teil für ${kat(a.kategorieId)}, den keine Position des Gemeinschaftskontos nutzt.`,
						tun: 'Kategorie einer Position zuordnen oder den Teil im Terminplan entfernen.'
					});
				}
			}
		}
	}

	// Doppelte Terminpläne: gleicher Empfänger und gleicher Betrag.
	const gesehen = new Map<string, Terminplan>();
	for (const t of offen) {
		if (!t.empfaenger || !e.zuordnung.has(t.id)) continue;
		const schluessel = `${t.empfaenger}|${t.betragCent}|${intervallMonate(t)}`;
		const erster = gesehen.get(schluessel);
		if (erster) {
			w.push({
				stufe: 'hinweis',
				terminplanId: t.id,
				text: `„${t.name}“ und „${erster.name}“ sehen gleich aus.`,
				tun: 'Doppelten Terminplan in Actual löschen.'
			});
		} else gesehen.set(schluessel, t);
	}

	const ids = new Set(e.terminplaene.map((t) => t.id));
	for (const p of e.verknuepft) {
		if (!ids.has(p.terminplanId)) {
			w.push({
				stufe: 'hinweis',
				terminplanId: p.terminplanId,
				text: `Den Terminplan zu „${p.name}“ gibt es in Actual nicht mehr.`,
				tun: 'Posten in der App löschen oder von Hand weiterführen.'
			});
		}
	}

	if (!e.gehaltKategorie) {
		w.push({
			stufe: 'hinweis',
			terminplanId: null,
			text: 'Es ist keine Gehaltskategorie gewählt. Die App erkennt das Gehalt nur am Betrag.',
			tun: 'Unter „Abgleich mit Actual“ die Kategorie wählen, in die dein Gehalt gebucht wird.'
		});
	} else if (!e.letztesGehalt || tageZwischen(e.letztesGehalt, e.heute) > 35) {
		w.push({
			stufe: 'hinweis',
			terminplanId: null,
			text: 'In der Gehaltskategorie gab es seit über einem Monat keine Buchung.',
			tun: 'Prüfen, ob die Regel in Actual das Gehalt dieser Kategorie zuordnet.'
		});
	}

	const rang = { warnung: 0, hinweis: 1 };
	return w.sort((a, b) => rang[a.stufe] - rang[b.stufe]);
}

/** Vorschlag für einen noch nicht zugeordneten Terminplan. */
export function schlageRolleVor(t: Terminplan, kontoId: string | null, dauerauftraege: Dauerauftrag[]): Rolle {
	if (t.beendet || t.kontoId !== kontoId || t.betragCent <= 0) return { typ: 'ignorieren' };
	// Umbuchungen und die Überweisung aufs Gemeinschaftskonto am Betrag erkennen.
	const passend = dauerauftraege.find((d) => Math.abs(d.betragCent - t.betragCent) <= ABWEICHUNG_CENT);
	if (passend && (t.umbuchung || passend.name === 'Gemeinschaftskonto')) {
		return { typ: 'dauerauftrag', name: passend.name };
	}
	return t.umbuchung ? { typ: 'ignorieren' } : { typ: 'fixkosten' };
}
