import {
	berechneGemeinschaftAnsicht,
	berechnePersonAnsicht,
	berechneRueckstellungen,
	type GemeinschaftEingaben,
	type RueckstellungEingabe
} from '#lib/rechnung/ansicht.ts';
import { berechneFixkosten } from '#lib/rechnung/fixkosten.ts';
import { actualEingerichtet } from './actual.ts';
import type { PersonId } from './db.ts';
import {
	ladeAuftraege,
	ladeGemeinschaft,
	ladePerson,
	ladePersonen,
	ladePosten,
	ladeActualStand,
	ladeRueckstellungen,
	type GemeinschaftEintrag,
	type PostenEintrag,
	type RueckstellungEintrag
} from './repo.ts';

export const anderePerson = (id: PersonId): PersonId => (id === 'a' ? 'b' : 'a');

/** Alles, was die Rechnung des Gemeinschaftskontos braucht. */
export function ladeGemeinschaftEingaben(): GemeinschaftEingaben<GemeinschaftEintrag, PostenEintrag> {
	const [a, b] = ladePersonen();
	return {
		konto: ladeGemeinschaft(),
		posten: ladePosten('gemeinsam'),
		personen: [
			{ name: a.name, nettoCent: a.nettoCent },
			{ name: b.name, nettoCent: b.nettoCent }
		]
	};
}

export function gemeinschaftAnsicht(stichtag: string) {
	return berechneGemeinschaftAnsicht(ladeGemeinschaftEingaben(), stichtag);
}

/** Jeder Posten mit seiner berechneten Zeile und den Zeilen seiner Beteiligungen. */
export function postenMitZeilen<P extends PostenEintrag>(posten: P[], stichtag: string, ueberweisungstag: number) {
	return posten.map((p) => {
		const [haupt, ...beteiligungen] = berechneFixkosten([p], { stichtag, ueberweisungstag }).zeilen;
		return { posten: p, zeile: haupt, beteiligungen };
	});
}

interface ActualSalden {
	kategorieSalden?: Record<string, number>;
	kategorien?: { id: string; name: string }[];
}

/** Warum der Stand aus Actual fehlt, oder null, wenn er da ist (oder keiner gebraucht wird). */
function fehlenderStand(r: RueckstellungEintrag, actual: boolean, stand: ActualSalden | null): string | null {
	if (r.art === 'fest' || !r.actualKategorie || stand?.kategorieSalden?.[r.actualKategorie] != null) return null;
	if (!actual) return 'Actual ist nicht eingerichtet, daher fehlt der Stand aus der Kategorie.';
	if (!stand) return 'Noch kein Abruf aus Actual, daher fehlt der Stand aus der Kategorie.';
	const name = stand.kategorien?.find((k) => k.id === r.actualKategorie)?.name;
	return name ? `Kategorie „${name}“ in Actual nicht gefunden.` : 'Kategorie in Actual nicht gefunden.';
}

/**
 * Rückstellungen einer Person mit ihrem Stand: aus Actual (nur wenn es eingerichtet ist), sonst von Hand.
 */
export function ladeRueckstellungsEingaben(id: PersonId) {
	const actual = actualEingerichtet(id);
	const stand = actual ? (ladeActualStand<ActualSalden>(id)?.daten ?? null) : null;
	return ladeRueckstellungen(id).map((r) => {
		const ausActual = r.actualKategorie ? (stand?.kategorieSalden?.[r.actualKategorie] ?? null) : null;
		const standCent = r.actualKategorie ? ausActual : r.standCent;
		return {
			eintrag: r,
			standCent,
			standQuelle: ausActual != null ? ('actual' as const) : standCent != null ? ('hand' as const) : null,
			hinweis: fehlenderStand(r, actual, stand)
		} satisfies RueckstellungEingabe<RueckstellungEintrag>;
	});
}

/** Stand und Monatsrate je Rückstellung einer Person. Übersicht und Einstellungen rechnen beide hiermit. */
export function rueckstellungenMitStand(id: PersonId, stichtag: string) {
	return berechneRueckstellungen(ladeRueckstellungsEingaben(id), ladePerson(id), stichtag);
}

/** Alle Eingaben der Personenansicht: Person, Posten, Rückstellungen mit Stand, Gemeinschaftskonto, Daueraufträge. */
export function ladePersonEingaben(id: PersonId) {
	return {
		id,
		person: ladePerson(id),
		posten: ladePosten(id),
		rueckstellungen: ladeRueckstellungsEingaben(id),
		gemeinschaft: ladeGemeinschaftEingaben(),
		auftraege: ladeAuftraege(id)
	};
}

export function personAnsicht(id: PersonId, stichtag: string) {
	return { ...berechnePersonAnsicht(ladePersonEingaben(id), stichtag), actual: actualEingerichtet(id) };
}
