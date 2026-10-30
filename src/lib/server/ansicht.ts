import {
	berechneAufstellung,
	berechneFixkosten,
	berechneGemeinschaft,
	sollVerlauf,
	vergleicheSollIst,
	type Zeile
} from '#lib/rechnung/index.ts';
import { berechneRueckstellung, zielVon } from '#lib/rechnung/rueckstellung.ts';
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
	type PostenEintrag,
	type RueckstellungEintrag
} from './repo.ts';

export const anderePerson = (id: PersonId): PersonId => (id === 'a' ? 'b' : 'a');

export function gemeinschaftAnsicht(stichtag: string) {
	const konto = ladeGemeinschaft();
	const posten = ladePosten('gemeinsam');
	const [a, b] = ladePersonen();
	const rechnung = berechneGemeinschaft(
		{ positionen: konto.positionen, fixkosten: posten, modell: konto.modell, rundung: konto.rundung ?? undefined },
		[
			{ name: a.name, nettoCent: a.nettoCent },
			{ name: b.name, nettoCent: b.nettoCent }
		],
		stichtag
	);
	return { konto, posten, rechnung, anteil: { a: rechnung.anteile[0], b: rechnung.anteile[1] } };
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
 * Stand und Monatsrate je Rückstellung einer Person. Der Stand kommt aus Actual (nur wenn es
 * eingerichtet ist), sonst von Hand. Übersicht und Einstellungen rechnen beide hiermit.
 */
export function rueckstellungenMitStand(id: PersonId, stichtag: string) {
	const person = ladePerson(id);
	const actual = actualEingerichtet(id);
	const stand = actual ? (ladeActualStand<ActualSalden>(id)?.daten ?? null) : null;
	return ladeRueckstellungen(id).map((r) => {
		const ausActual = r.actualKategorie ? (stand?.kategorieSalden?.[r.actualKategorie] ?? null) : null;
		const hinweis = fehlenderStand(r, actual, stand);
		const standCent = r.actualKategorie ? ausActual : r.standCent;
		return {
			eintrag: r,
			standQuelle: ausActual != null ? ('actual' as const) : standCent != null ? ('hand' as const) : null,
			hinweis,
			...berechneRueckstellung(r, {
				standCent,
				nettoCent: person.nettoCent,
				stichtag,
				ueberweisungstag: person.ueberweisungstag,
				standUnbekannt: hinweis != null
			})
		};
	});
}

export function personAnsicht(id: PersonId, stichtag: string) {
	const person = ladePerson(id);
	const posten = ladePosten(id);
	const rueckstellungen = rueckstellungenMitStand(id, stichtag);
	const gemeinschaft = gemeinschaftAnsicht(stichtag);
	const einstellungen = { stichtag, ueberweisungstag: person.ueberweisungstag };
	const fixkosten = berechneFixkosten(posten, einstellungen);
	const auftraege = ladeAuftraege(id);
	const aufstellung = berechneAufstellung({
		modus: person.modus,
		nettoCent: person.nettoCent,
		auftraege,
		rueckstellungen: rueckstellungen.map((r) => ({ name: r.eintrag.name, betragCent: r.rateCent, zielkonto: zielVon(r.eintrag) })),
		gemeinschaftCent: gemeinschaft.anteil[id].betragCent,
		fixkostenMonatlichCent: fixkosten.summeMonatlichCent
	});
	for (const r of rueckstellungen) {
		if (r.hinweis && r.eintrag.aktiv && r.eintrag.art !== 'fest') {
			const folge = r.eintrag.art === 'faellig' ? 'Ohne Stand ist keine Rate eingeplant.' : 'Die Rate ist nicht am Ziel gekappt.';
			aufstellung.warnungen.push(`Rücklage „${r.eintrag.name}“: ${r.hinweis} ${folge}`);
		}
	}
	const ausstehendCent =
		person.modus !== 1
			? 0
			: person.istQuelle === 'actual'
				? (person.abgleich?.ausstehendCent ?? 0)
				: person.istAusstehend
					? aufstellung.dauerauftraege.reduce((s, d) => s + d.betragCent, 0)
					: 0;
	const vergleich =
		person.istCent == null
			? null
			: vergleicheSollIst({
					sollCent: fixkosten.sollCent,
					istCent: person.istCent,
					ausstehendCent,
					pufferCent: person.pufferCent
				});
	const naechste: Zeile[] = fixkosten.zeilen
		.filter((z) => z.naechsteBuchung && !z.gehoertZu && z.betragCent > 0)
		.sort((x, y) => x.naechsteBuchung!.localeCompare(y.naechsteBuchung!))
		.slice(0, 4);

	return {
		person,
		posten,
		rueckstellungen,
		gemeinschaft,
		fixkosten,
		aufstellung,
		vergleich,
		ausstehendCent,
		naechste,
		auftraege,
		actual: actualEingerichtet(id),
		verlauf: posten.length ? sollVerlauf(posten, stichtag, person.ueberweisungstag) : []
	};
}
