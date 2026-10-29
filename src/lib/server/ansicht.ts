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
export function postenMitZeilen(posten: PostenEintrag[], stichtag: string, ueberweisungstag: number) {
	return posten.map((p) => {
		const [haupt, ...beteiligungen] = berechneFixkosten([p], { stichtag, ueberweisungstag }).zeilen;
		return { posten: p, zeile: haupt, beteiligungen };
	});
}

/** Stand und Monatsrate je Rückstellung; der Stand kommt aus Actual, sonst von Hand. */
export function rueckstellungenMitStand(
	liste: RueckstellungEintrag[],
	e: { nettoCent: number; stichtag: string; ueberweisungstag: number; salden: Record<string, number> | null }
) {
	return liste.map((r) => {
		const ausActual = r.actualKategorie && e.salden ? (e.salden[r.actualKategorie] ?? null) : null;
		const standCent = ausActual ?? r.standCent;
		return {
			eintrag: r,
			standQuelle: ausActual != null ? ('actual' as const) : r.standCent != null ? ('hand' as const) : null,
			...berechneRueckstellung(r, { standCent, nettoCent: e.nettoCent, stichtag: e.stichtag, ueberweisungstag: e.ueberweisungstag })
		};
	});
}

export function personAnsicht(id: PersonId, stichtag: string) {
	const person = ladePerson(id);
	const posten = ladePosten(id);
	const rueckstellungen = rueckstellungenMitStand(ladeRueckstellungen(id), {
		nettoCent: person.nettoCent,
		stichtag,
		ueberweisungstag: person.ueberweisungstag,
		salden: ladeActualStand<{ kategorieSalden?: Record<string, number> }>(id)?.daten.kategorieSalden ?? null
	});
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
