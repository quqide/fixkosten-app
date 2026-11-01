/**
 * Reine Rechnung der Personenansicht: aus eingesammelten Eingaben Fixkosten, Gemeinschaftsanteile,
 * Rückstellungsraten und Monatsaufstellung, ohne Datenbankzugriff. Das Laden steht in
 * `src/lib/server/ansicht.ts`.
 */
import type { Abgleich } from './abgleich';
import { berechneAufstellung, type AuftragKonfig, type Kontenmodus } from './aufstellung';
import type { IsoDatum } from './datum';
import { berechneFixkosten, type FixkostenPosten, type Zeile } from './fixkosten';
import { berechneGemeinschaft, type Aufteilungsmodell, type Person, type Position } from './gemeinschaft';
import { berechneRueckstellung, zielVon, type RueckstellungKonfig } from './rueckstellung';
import type { Rundung } from './rundung';
import { vergleicheSollIst } from './status';
import { sollVerlauf } from './verlauf';

export type PersonSchluessel = 'a' | 'b';

// ---------- Gemeinschaftskonto ----------

export interface GemeinschaftEingaben<
	K extends { positionen: Position[]; modell: Aufteilungsmodell; rundung: Rundung | null } = {
		positionen: Position[];
		modell: Aufteilungsmodell;
		rundung: Rundung | null;
	},
	F extends FixkostenPosten = FixkostenPosten
> {
	konto: K;
	/** Gemeinsame Fixkosten. */
	posten: F[];
	/** Person A und B, in dieser Reihenfolge. */
	personen: [Person, Person];
}

export function berechneGemeinschaftAnsicht<E extends GemeinschaftEingaben>(e: E, stichtag: IsoDatum) {
	const { konto, posten } = e as { konto: E['konto']; posten: E['posten'] };
	const rechnung = berechneGemeinschaft(
		{ positionen: konto.positionen, fixkosten: posten, modell: konto.modell, rundung: konto.rundung ?? undefined },
		e.personen,
		stichtag
	);
	return { konto, posten, rechnung, anteil: { a: rechnung.anteile[0], b: rechnung.anteile[1] } };
}

// ---------- Rückstellungen ----------

/** Eine Rückstellung mit dem Stand, den die Ladefunktion gefunden hat. */
export interface RueckstellungEingabe<R extends RueckstellungKonfig = RueckstellungKonfig> {
	eintrag: R;
	standCent: number | null;
	standQuelle: 'actual' | 'hand' | null;
	/** Warum der Stand fehlt, oder null. */
	hinweis: string | null;
}

/** Monatsrate je Rückstellung. Übersicht und Einstellungen rechnen beide hiermit. */
export function berechneRueckstellungen<R extends RueckstellungKonfig>(
	liste: RueckstellungEingabe<R>[],
	person: { nettoCent: number; ueberweisungstag: number },
	stichtag: IsoDatum
) {
	return liste.map(({ eintrag, standCent, standQuelle, hinweis }) => ({
		eintrag,
		standQuelle,
		hinweis,
		...berechneRueckstellung(eintrag, {
			standCent,
			nettoCent: person.nettoCent,
			stichtag,
			ueberweisungstag: person.ueberweisungstag,
			standUnbekannt: hinweis != null
		})
	}));
}

// ---------- Personenansicht ----------

/** Was die Rechnung von einer Person braucht. */
export interface PersonDaten {
	nettoCent: number;
	ueberweisungstag: number;
	modus: Kontenmodus;
	pufferCent: number;
	istCent: number | null;
	istAusstehend: boolean;
	istQuelle: 'hand' | 'actual';
	abgleich: Pick<Abgleich, 'ausstehendCent'> | null;
}

export interface PersonAnsichtEingaben {
	id: PersonSchluessel;
	person: PersonDaten;
	posten: FixkostenPosten[];
	rueckstellungen: RueckstellungEingabe[];
	gemeinschaft: GemeinschaftEingaben;
	auftraege: AuftragKonfig[];
}

export function berechnePersonAnsicht<E extends PersonAnsichtEingaben>(e: E, stichtag: IsoDatum) {
	const { id } = e;
	const person = e.person as E['person'];
	const posten = e.posten as E['posten'];
	const auftraege = e.auftraege as E['auftraege'];
	const rueckstellungen = berechneRueckstellungen(e.rueckstellungen as E['rueckstellungen'][number][], person, stichtag);
	const gemeinschaft = berechneGemeinschaftAnsicht(e.gemeinschaft as E['gemeinschaft'], stichtag);
	const einstellungen = { stichtag, ueberweisungstag: person.ueberweisungstag };
	const fixkosten = berechneFixkosten(posten, einstellungen);
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
		verlauf: posten.length ? sollVerlauf(posten, stichtag, person.ueberweisungstag) : []
	};
}
