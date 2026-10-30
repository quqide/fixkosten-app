import { gleicheAb } from '#lib/rechnung/abgleich.ts';
import { heute } from '#lib/rechnung/datum.ts';
import {
	alsPosten,
	hinweisSchluessel,
	istAusblendbar,
	pruefeTerminplaene,
	schlageRolleVor,
	type Rolle,
	type Terminplan,
	type Warnung
} from '#lib/rechnung/terminplan.ts';
import { actualEingerichtet, ladeAbgleich, type ActualDaten } from './actual.ts';
import { personAnsicht } from './ansicht.ts';
import type { PersonId } from './db.ts';
import {
	aktualisierePerson,
	ladeActualStand,
	ladeAusblendungen,
	type Ausblendung,
	ladePerson,
	ladePosten,
	ladePostenZuTerminplan,
	ladeZuordnung,
	speichereActualStand,
	uebernehmePosten
} from './repo.ts';

export type Schnappschuss = Omit<ActualDaten, 'buchungen' | 'saldoCent'>;

export function rollenVon(person: PersonId): Map<string, Rolle> {
	return new Map(
		ladeZuordnung(person).map((z) => [
			z.terminplan,
			z.rolle === 'dauerauftrag' ? { typ: 'dauerauftrag', name: z.dauerauftrag ?? '' } : { typ: z.rolle }
		])
	);
}

const eur = (cent: number) => (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/** Überträgt die als Fixkosten zugeordneten Terminpläne in die Posten der Person. */
export function uebernehmeTerminplaene(person: PersonId, terminplaene: Terminplan[]) {
	const rollen = rollenVon(person);
	let geaendert = 0;
	for (const t of terminplaene) {
		if (rollen.get(t.id)?.typ !== 'fixkosten' || t.beendet) continue;
		const werte = alsPosten(t);
		if (!werte) continue;
		const vorher = ladePostenZuTerminplan(person, t.id);
		if (!vorher) {
			uebernehmePosten(
				{ ...werte, besitzer: person, beteiligungen: [], abbuchungsart: 'Lastschrift', actualTerminplan: t.id },
				person,
				`„${werte.name}“ aus Actual übernommen`
			);
			geaendert++;
			continue;
		}
		const gleich =
			vorher.name === werte.name &&
			vorher.betragCent === werte.betragCent &&
			vorher.intervallMonate === werte.intervallMonate &&
			vorher.buchungsdatum === werte.buchungsdatum;
		if (gleich) continue;
		// Nur Preisänderungen sind eine Zeile im Verlauf wert, ein neues Datum nicht.
		const text =
			vorher.betragCent !== werte.betragCent
				? `„${werte.name}“: ${eur(vorher.betragCent)} → ${eur(werte.betragCent)}, aus Actual`
				: null;
		uebernehmePosten({ ...vorher, ...werte }, person, text);
		geaendert++;
	}
	return geaendert;
}

/** Holt alles aus Actual, gleicht die Posten ab und speichert Kontostand und Erkennung. */
export async function holeAusActual(person: PersonId) {
	const p = ladePerson(person);
	if (!p.actualKontoId) throw new Error('Kein Konto in Actual gewählt.');
	const stichtag = heute();
	const daten = await ladeAbgleich(person, p.actualKontoId, stichtag);
	const { buchungen, saldoCent, ...schnappschuss } = daten;
	speichereActualStand(person, schnappschuss satisfies Schnappschuss);
	const geaendert = uebernehmeTerminplaene(person, daten.terminplaene);

	const { aufstellung } = personAnsicht(person, stichtag);
	const auftragsPlaene = new Map<string, string>();
	for (const [id, rolle] of rollenVon(person)) if (rolle.typ === 'dauerauftrag') auftragsPlaene.set(rolle.name, id);
	const abgleich = gleicheAb({
		buchungen,
		nettoCent: p.nettoCent,
		dauerauftraege: aufstellung.dauerauftraege,
		gehaltKategorie: p.actualGehaltKategorie,
		terminplaene: auftragsPlaene
	});
	aktualisierePerson(person, { istCent: saldoCent, istDatum: stichtag, istQuelle: 'actual', abgleich });
	return { geaendert };
}

/**
 * Warnungen zur Einrichtung in Actual, aus dem letzten Abruf, ohne ausgeblendete Hinweise.
 * Ohne eingerichtetes Actual keine: ein alter Abruf zählt dann nicht mehr.
 */
export function warnungenFuer(person: PersonId): Warnung[] {
	if (!actualEingerichtet(person)) return [];
	const aus = new Set(ladeAusblendungen(person).map((h) => hinweisSchluessel(h.terminplan, h.art)));
	return alleWarnungen(person).filter((w) => !(istAusblendbar(w) && aus.has(hinweisSchluessel(w.terminplanId!, w.art))));
}

/** Die ausgeblendeten Hinweise mit der Meldung, falls sie gerade noch zutrifft. */
export function ausgeblendeteHinweise(person: PersonId): (Ausblendung & { meldung: Warnung | null; name: string | null })[] {
	const alle = alleWarnungen(person);
	const plaene = new Map((ladeActualStand<Schnappschuss>(person)?.daten.terminplaene ?? []).map((t) => [t.id, t.name]));
	const posten = new Map(ladePosten(person).filter((p) => p.actualTerminplan).map((p) => [p.actualTerminplan!, p.name]));
	return ladeAusblendungen(person).map((h) => ({
		...h,
		meldung: alle.find((w) => w.terminplanId === h.terminplan && w.art === h.art) ?? null,
		name: plaene.get(h.terminplan) ?? posten.get(h.terminplan) ?? null
	}));
}

function alleWarnungen(person: PersonId): Warnung[] {
	const p = ladePerson(person);
	const stand = ladeActualStand<Schnappschuss>(person);
	if (!p.actualKontoId || !stand) return [];
	const { aufstellung, auftraege, gemeinschaft } = personAnsicht(person, heute());
	const gemeinschaftsAuftrag = auftraege.find((a) => a.bausteine.some((b) => b.typ === 'gemeinschaft'));
	const kategorien = new Map(stand.daten.kategorien.map((k) => [k.id, k.name]));
	return pruefeTerminplaene({
		gemeinschaft: gemeinschaftsAuftrag
			? {
					auftrag: gemeinschaftsAuftrag.name,
					teile: gemeinschaft.anteil[person].positionen.map((t, i) => ({
						...t,
						kategorieId: gemeinschaft.konto.positionen[i]?.kategorie[person] ?? null
					}))
				}
			: null,
		kategorieName: (id) => kategorien.get(id) ?? 'unbekannte Kategorie',
		terminplaene: stand.daten.terminplaene,
		zuordnung: rollenVon(person),
		kontoId: p.actualKontoId,
		kontoName: p.actualKontoName,
		dauerauftraege: aufstellung.dauerauftraege,
		gehaltKategorie: p.actualGehaltKategorie,
		letztesGehalt: p.actualGehaltKategorie ? (stand.daten.letzteEinnahmen?.[p.actualGehaltKategorie] ?? null) : null,
		verknuepft: ladePosten(person)
			.filter((x) => x.actualTerminplan)
			.map((x) => ({ name: x.name, terminplanId: x.actualTerminplan! })),
		heute: heute()
	});
}

function wahlWert(r: Rolle, verknuepfbar: () => number | undefined) {
	if (r.typ === 'dauerauftrag') return `dauerauftrag:${r.name}`;
	if (r.typ === 'ignorieren') return 'ignorieren';
	const id = verknuepfbar();
	return id ? `fixkosten:${id}` : 'fixkosten';
}

/** Alles für die Zuordnungsliste in den Einstellungen. */
export function zuordnungAnsicht(person: PersonId) {
	const p = ladePerson(person);
	const stand = ladeActualStand<Schnappschuss>(person);
	if (!stand) return null;
	const { aufstellung } = personAnsicht(person, heute());
	const rollen = rollenVon(person);
	const posten = ladePosten(person);
	const frei = posten.filter((x) => !x.actualTerminplan);
	const einfach = (s: string) => s.toLocaleLowerCase('de-DE').replace(/[^a-z0-9äöüß]/g, '');
	const gleichnamig = (name: string) => {
		const n = einfach(name);
		return frei.find((x) => {
			const m = einfach(x.name);
			return n && m && (n === m || n.includes(m) || m.includes(n));
		});
	};
	const terminplaene = [...stand.daten.terminplaene]
		.filter((t) => !t.beendet || rollen.has(t.id))
		.sort(
			(a, b) =>
				Number(b.kontoId === p.actualKontoId) - Number(a.kontoId === p.actualKontoId) ||
				Number(rollen.has(a.id)) - Number(rollen.has(b.id)) ||
				b.betragCent - a.betragCent
		)
		.map((t) => ({
			...t,
			rolle: rollen.get(t.id) ?? null,
			/** Wert der Auswahl: gespeicherte Rolle, sonst Vorschlag (mit gleichnamigem Posten verknüpft). */
			wahl: wahlWert(rollen.get(t.id) ?? schlageRolleVor(t, p.actualKontoId, aufstellung.dauerauftraege), () =>
				rollen.has(t.id) ? undefined : gleichnamig(t.name)?.id
			)
		}));
	return {
		zeit: stand.zeit,
		terminplaene,
		einnahmeKategorien: stand.daten.kategorien.filter((k) => k.einnahme),
		dauerauftraege: aufstellung.dauerauftraege.map((d) => d.name),
		// Von Hand angelegte Posten, die sich mit einem Terminplan verknüpfen lassen.
		freiePosten: frei.map((x) => ({ id: x.id!, name: x.name }))
	};
}
