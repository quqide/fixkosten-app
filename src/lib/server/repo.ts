import type { Abbuchungsart, Art, Beteiligung, FixkostenPosten } from '#lib/rechnung/fixkosten.ts';
import type { Aufteilungsmodell } from '#lib/rechnung/gemeinschaft.ts';
import { eindeutigeNamen, type AuftragKonfig, type Baustein, type Kontenmodus } from '#lib/rechnung/aufstellung.ts';
import type { Rundung } from '#lib/rechnung/rundung.ts';
import type { Abgleich } from '#lib/rechnung/abgleich.ts';
import { type RueckstellungKonfig, type RueckstellungsArt } from '#lib/rechnung/rueckstellung.ts';
import { db, legeAuftraegeAn, transaktion, type Besitzer, type PersonId } from './db.ts';
import { pruefeAuftraege, pruefeVertrag } from './formular.ts';
import { istPostenIcon } from '#lib/postenIcons.ts';
import { AUSBLENDBARE_ARTEN, type WarnungArt } from '#lib/rechnung/terminplan.ts';
import { istLeer, type FristEinheit, type Vertrag } from '#lib/rechnung/vertrag.ts';

export type Hell = 'auto' | 'light' | 'dark';

export interface Person {
	id: PersonId;
	name: string;
	nettoCent: number;
	etfProzent: number;
	ueberweisungstag: number;
	modus: Kontenmodus;
	pufferCent: number;
	istCent: number | null;
	istDatum: string | null;
	/** Gehalt ist da, die Daueraufträge des Monats aber noch nicht gebucht. */
	istAusstehend: boolean;
	/** Woher der Kontostand stammt: von Hand eingetragen oder aus Actual Budget. */
	istQuelle: 'hand' | 'actual';
	/** Was beim letzten Abruf aus Actual erkannt wurde. */
	abgleich: Abgleich | null;
	actualKontoId: string | null;
	actualKontoName: string | null;
	/** Kategorie in Actual, in die das Gehalt gebucht wird. */
	actualGehaltKategorie: string | null;
	theme: string;
	hell: Hell;
}

export interface GespeicherteBeteiligung extends Beteiligung {
	id?: number;
}

export interface PostenEintrag extends FixkostenPosten {
	id?: number;
	besitzer: Besitzer;
	beteiligungen: GespeicherteBeteiligung[];
	/** Terminplan in Actual, aus dem Name, Betrag, Intervall und Datum kommen. */
	actualTerminplan?: string | null;
}

export interface RueckstellungEintrag extends RueckstellungKonfig {
	id?: number;
	person: PersonId;
	/** Kategorie in Actual, deren Saldo der Stand ist. */
	actualKategorie: string | null;
	/** Von Hand eingetragener Stand, wenn keine Kategorie gewählt ist. */
	standCent: number | null;
	standDatum: string | null;
}

/** Was mit dem Geld einer Position vom Gemeinschaftskonto passiert. */
export interface Ausgang {
	art: 'ueberweisung' | 'umbuchung';
	ziel: string;
	tag: number | null;
}

export interface PositionEintrag {
	id?: number;
	name: string;
	art: 'fest' | 'fixkosten';
	betragCent: number;
	ausgang: Ausgang | null;
	/** Kategorie in Actual je Person, für die Prüfung der Aufteilung im Terminplan. */
	kategorie: { a: string | null; b: string | null };
}

export interface GemeinschaftEintrag {
	positionen: PositionEintrag[];
	modell: Aufteilungsmodell;
	rundung: Rundung | null;
}

export interface AuftragEintrag extends AuftragKonfig {
	id?: number;
}

export interface Aenderung {
	id: number;
	zeit: string;
	person: PersonId;
	bereich: string;
	text: string;
	kannRueckgaengig: boolean;
}

type Rueckgaengig =
	| { typ: 'posten'; id: number; vorher: PostenEintrag | null }
	| { typ: 'person'; vorher: Person }
	| { typ: 'gemeinschaft'; vorher: GemeinschaftEintrag }
	| { typ: 'rueckstellungen'; person: PersonId; vorher: RueckstellungEintrag[] }
	| { typ: 'auftraege'; person: PersonId; vorher: AuftragEintrag[] }
	/** Kontenmodell und die dazu angepassten Daueraufträge, nur gemeinsam rückgängig. */
	| { typ: 'modus'; vorher: Person; auftraege: AuftragEintrag[] }
	| { typ: 'ausblendung'; person: PersonId; hinweis: Ausblendung; warAusgeblendet: boolean };

type Zeile = Record<string, unknown>;

const inTransaktion = <T>(fn: () => T): T => transaktion(db(), fn);

// ---------- Personen ----------

function zuPerson(z: Zeile): Person {
	return {
		id: z.id as PersonId,
		name: z.name as string,
		nettoCent: Number(z.netto_cent),
		etfProzent: Number(z.etf_prozent),
		ueberweisungstag: Number(z.ueberweisungstag),
		modus: Number(z.modus) as Kontenmodus,
		pufferCent: Number(z.puffer_cent),
		istCent: z.ist_cent == null ? null : Number(z.ist_cent),
		istDatum: (z.ist_datum as string | null) ?? null,
		istAusstehend: Number(z.ist_ausstehend) === 1,
		istQuelle: z.ist_quelle === 'actual' ? 'actual' : 'hand',
		abgleich: z.abgleich ? (JSON.parse(z.abgleich as string) as Abgleich) : null,
		actualKontoId: (z.actual_konto_id as string | null) ?? null,
		actualKontoName: (z.actual_konto_name as string | null) ?? null,
		actualGehaltKategorie: (z.actual_gehalt_kategorie as string | null) ?? null,
		theme: z.theme as string,
		hell: z.hell as Hell
	};
}

export function ladePersonen(): Person[] {
	return (db().prepare('SELECT * FROM personen ORDER BY id').all() as Zeile[]).map(zuPerson);
}

export function ladePerson(id: PersonId): Person {
	return zuPerson(db().prepare('SELECT * FROM personen WHERE id = ?').get(id) as Zeile);
}

function schreibePerson(p: Person) {
	db()
		.prepare(
			`UPDATE personen SET name = ?, netto_cent = ?, etf_prozent = ?, ueberweisungstag = ?, modus = ?,
			puffer_cent = ?, ist_cent = ?, ist_datum = ?, ist_ausstehend = ?, ist_quelle = ?, abgleich = ?,
			actual_konto_id = ?, actual_konto_name = ?, actual_gehalt_kategorie = ?, theme = ?, hell = ? WHERE id = ?`
		)
		.run(
			p.name,
			p.nettoCent,
			p.etfProzent,
			p.ueberweisungstag,
			p.modus,
			p.pufferCent,
			p.istCent,
			p.istDatum,
			p.istAusstehend ? 1 : 0,
			p.istQuelle ?? 'hand',
			p.abgleich ? JSON.stringify(p.abgleich) : null,
			p.actualKontoId ?? null,
			p.actualKontoName ?? null,
			p.actualGehaltKategorie ?? null,
			p.theme,
			p.hell,
			p.id
		);
}

/** Abgerufene Werte (Kontostand aus Actual) ohne Eintrag im Verlauf speichern. */
export function aktualisierePerson(id: PersonId, teil: Partial<Omit<Person, 'id'>>) {
	schreibePerson({ ...ladePerson(id), ...teil });
}

export function aenderePerson(id: PersonId, teil: Partial<Omit<Person, 'id'>>, wer: PersonId, text: string) {
	return inTransaktion(() => {
		const vorher = ladePerson(id);
		schreibePerson({ ...vorher, ...teil });
		return protokolliere(wer, `person-${id}`, text, { typ: 'person', vorher });
	});
}

// ---------- Posten ----------

function ladeBeteiligungen(postenId: number): GespeicherteBeteiligung[] {
	return (
		db().prepare('SELECT * FROM beteiligungen WHERE posten_id = ? ORDER BY id').all(postenId) as Zeile[]
	).map((b) => ({
		id: Number(b.id),
		name: b.name as string,
		betragCent: Number(b.betrag_cent),
		eingangstag: b.eingangstag == null ? null : Number(b.eingangstag)
	}));
}

function zuPosten(z: Zeile): PostenEintrag {
	return {
		id: Number(z.id),
		besitzer: z.besitzer as Besitzer,
		name: z.name as string,
		intervallMonate: Number(z.intervall),
		betragCent: Number(z.betrag_cent),
		art: (z.art as Art | null) ?? null,
		abbuchungsart: (z.abbuchungsart as Abbuchungsart | null) ?? null,
		buchungsdatum: (z.buchungsdatum as string | null) ?? null,
		actualTerminplan: (z.actual_terminplan as string | null) ?? null,
		icon: (z.icon as string | null) ?? null,
		vertrag: vertragAus(z),
		beteiligungen: ladeBeteiligungen(Number(z.id))
	};
}

function vertragAus(z: Zeile): Vertrag | null {
	const v: Vertrag = {
		laufzeitEnde: (z.vertrag_ende as string | null) ?? null,
		kuendigungsfrist:
			z.kuendigung_anzahl == null ? null : { anzahl: Number(z.kuendigung_anzahl), einheit: z.kuendigung_einheit as FristEinheit },
		verlaengerungMonate: z.verlaengerung_monate == null ? null : Number(z.verlaengerung_monate),
		kundennummer: (z.kundennummer as string | null) ?? null,
		notiz: (z.notiz as string | null) ?? null
	};
	return istLeer(v) ? null : v;
}

export function ladePosten(besitzer: Besitzer): PostenEintrag[] {
	return (
		db()
			.prepare('SELECT * FROM posten WHERE besitzer = ? ORDER BY betrag_cent / intervall DESC, name')
			.all(besitzer) as Zeile[]
	).map(zuPosten);
}

export function ladeEinzelposten(id: number): PostenEintrag | null {
	const z = db().prepare('SELECT * FROM posten WHERE id = ?').get(id) as Zeile | undefined;
	return z ? zuPosten(z) : null;
}

function schreibePosten(p: PostenEintrag, id?: number): number {
	const werte = [
		p.besitzer,
		p.name,
		p.intervallMonate,
		p.betragCent,
		p.art ?? null,
		p.abbuchungsart ?? null,
		p.buchungsdatum ?? null,
		p.actualTerminplan ?? null,
		p.icon ?? null,
		p.vertrag?.laufzeitEnde ?? null,
		p.vertrag?.kuendigungsfrist?.anzahl ?? null,
		p.vertrag?.kuendigungsfrist?.einheit ?? null,
		p.vertrag?.verlaengerungMonate ?? null,
		p.vertrag?.kundennummer ?? null,
		p.vertrag?.notiz ?? null
	] as const;
	const spalten = `besitzer, name, intervall, betrag_cent, art, abbuchungsart, buchungsdatum, actual_terminplan, icon,
		vertrag_ende, kuendigung_anzahl, kuendigung_einheit, verlaengerung_monate, kundennummer, notiz`;
	const platzhalter = werte.map(() => '?').join(', ');
	let postenId: number;
	if (id != null) {
		const vorhanden = db().prepare('SELECT id FROM posten WHERE id = ?').get(id);
		if (vorhanden) {
			db()
				.prepare(`UPDATE posten SET (${spalten}) = (${platzhalter}) WHERE id = ?`)
				.run(...werte, id);
		} else {
			db()
				.prepare(`INSERT INTO posten (${spalten}, id) VALUES (${platzhalter}, ?)`)
				.run(...werte, id);
		}
		postenId = id;
	} else {
		const r = db()
			.prepare(`INSERT INTO posten (${spalten}) VALUES (${platzhalter})`)
			.run(...werte);
		postenId = Number(r.lastInsertRowid);
	}
	db().prepare('DELETE FROM beteiligungen WHERE posten_id = ?').run(postenId);
	for (const b of p.beteiligungen) {
		db()
			.prepare('INSERT INTO beteiligungen (posten_id, name, betrag_cent, eingangstag) VALUES (?, ?, ?, ?)')
			.run(postenId, b.name, b.betragCent, b.eingangstag ?? null);
	}
	return postenId;
}

export function speicherePosten(p: PostenEintrag, wer: PersonId) {
	return inTransaktion(() => {
		const vorher = p.id != null ? ladeEinzelposten(p.id) : null;
		const id = schreibePosten(p, p.id);
		const text = vorher ? `„${p.name}“ geändert` : `„${p.name}“ hinzugefügt`;
		const undoId = protokolliere(wer, bereichVon(p.besitzer), text, { typ: 'posten', id, vorher });
		return { id, undoId, text };
	});
}

export function loeschePosten(id: number, wer: PersonId) {
	return inTransaktion(() => {
		const vorher = ladeEinzelposten(id);
		if (!vorher) return null;
		db().prepare('DELETE FROM posten WHERE id = ?').run(id);
		const text = `„${vorher.name}“ gelöscht`;
		// Rückgängig stellt den gelöschten Posten mit allen Beteiligungen wieder her.
		const undoId = protokolliere(wer, bereichVon(vorher.besitzer), text, { typ: 'posten', id, vorher });
		return { undoId, text };
	});
}

function bereichVon(besitzer: Besitzer) {
	return besitzer === 'gemeinsam' ? 'gemeinsam' : `fixkosten-${besitzer}`;
}

/**
 * Übernimmt Werte aus Actual in einen Posten (neu oder vorhanden). Im Verlauf steht es,
 * rückgängig machen lässt es sich nicht, weil der nächste Abruf es wiederherstellen würde.
 */
export function uebernehmePosten(p: PostenEintrag, wer: PersonId, text: string | null) {
	return inTransaktion(() => {
		const id = schreibePosten(p, p.id);
		if (text) protokolliere(wer, bereichVon(p.besitzer), text, null);
		return id;
	});
}

export function ladePostenZuTerminplan(besitzer: Besitzer, terminplan: string): PostenEintrag | null {
	const z = db()
		.prepare('SELECT * FROM posten WHERE besitzer = ? AND actual_terminplan = ?')
		.get(besitzer, terminplan) as Zeile | undefined;
	return z ? zuPosten(z) : null;
}

export function setzeTerminplan(postenId: number, terminplan: string | null) {
	db().prepare('UPDATE posten SET actual_terminplan = ? WHERE id = ?').run(terminplan, postenId);
}

// ---------- Actual: Abruf und Zuordnung ----------

export function speichereActualStand(person: PersonId, daten: unknown) {
	db()
		.prepare('INSERT OR REPLACE INTO actual_stand (person, zeit, daten) VALUES (?, ?, ?)')
		.run(person, new Date().toISOString(), JSON.stringify(daten));
}

export function ladeActualStand<T>(person: PersonId): { zeit: string; daten: T } | null {
	const z = db().prepare('SELECT * FROM actual_stand WHERE person = ?').get(person) as Zeile | undefined;
	return z ? { zeit: z.zeit as string, daten: JSON.parse(z.daten as string) as T } : null;
}

export interface ZuordnungEintrag {
	terminplan: string;
	rolle: 'fixkosten' | 'dauerauftrag' | 'ignorieren';
	dauerauftrag: string | null;
}

export function ladeZuordnung(person: PersonId): ZuordnungEintrag[] {
	return (
		db().prepare('SELECT * FROM actual_zuordnung WHERE person = ?').all(person) as Zeile[]
	).map((z) => ({
		terminplan: z.terminplan as string,
		rolle: z.rolle as ZuordnungEintrag['rolle'],
		dauerauftrag: (z.dauerauftrag as string | null) ?? null
	}));
}

export function speichereZuordnung(person: PersonId, liste: ZuordnungEintrag[], wer: PersonId) {
	inTransaktion(() => {
		db().prepare('DELETE FROM actual_zuordnung WHERE person = ?').run(person);
		const einf = db().prepare(
			'INSERT INTO actual_zuordnung (person, terminplan, rolle, dauerauftrag) VALUES (?, ?, ?, ?)'
		);
		for (const z of liste) einf.run(person, z.terminplan, z.rolle, z.dauerauftrag);
		protokolliere(wer, `person-${person}`, 'Terminpläne aus Actual zugeordnet', null);
	});
}

// ---------- Ausgeblendete Hinweise ----------

/** Ein ausgeblendeter Hinweis: Schlüssel ist immer die terminplanId der Meldung und ihre Art. */
export interface Ausblendung {
	terminplan: string;
	art: WarnungArt;
}

export class NichtAusblendbar extends Error {
	constructor() {
		super('Warnungen lassen sich nicht ausblenden, nur Hinweise.');
	}
}

export function ladeAusblendungen(person: PersonId): Ausblendung[] {
	return (
		db().prepare('SELECT terminplan, art FROM ausgeblendete_hinweise WHERE person = ? ORDER BY terminplan, art').all(person) as Zeile[]
	).map((z) => ({ terminplan: z.terminplan as string, art: z.art as WarnungArt }));
}

function schreibeAusblendung(person: PersonId, h: Ausblendung, ausgeblendet: boolean) {
	if (ausgeblendet) {
		db().prepare('INSERT OR IGNORE INTO ausgeblendete_hinweise (person, terminplan, art) VALUES (?, ?, ?)').run(person, h.terminplan, h.art);
	} else {
		db().prepare('DELETE FROM ausgeblendete_hinweise WHERE person = ? AND terminplan = ? AND art = ?').run(person, h.terminplan, h.art);
	}
}

/** Blendet einen Hinweis aus oder wieder ein. Warnungen lehnt die Funktion ab (NichtAusblendbar). */
export function setzeAusblendung(person: PersonId, h: Ausblendung, ausgeblendet: boolean, wer: PersonId, text: string) {
	if (ausgeblendet && (!h.terminplan || !AUSBLENDBARE_ARTEN.has(h.art))) throw new NichtAusblendbar();
	return inTransaktion(() => {
		const warAusgeblendet = ladeAusblendungen(person).some((x) => x.terminplan === h.terminplan && x.art === h.art);
		schreibeAusblendung(person, h, ausgeblendet);
		return protokolliere(wer, `person-${person}`, text, { typ: 'ausblendung', person, hinweis: h, warAusgeblendet });
	});
}

// ---------- Rückstellungen ----------

export function ladeRueckstellungen(person: PersonId): RueckstellungEintrag[] {
	return (
		db().prepare('SELECT * FROM rueckstellungen WHERE person = ? ORDER BY id').all(person) as Zeile[]
	).map((z) => ({
		id: Number(z.id),
		person,
		name: z.name as string,
		art: ((z.art as RueckstellungsArt | null) ?? 'fest'),
		betragCent: Number(z.betrag_cent),
		zielCent: z.ziel_cent == null ? null : Number(z.ziel_cent),
		zielNettoFaktor: z.ziel_netto_faktor == null ? null : Number(z.ziel_netto_faktor),
		faellig: (z.faellig as string | null) ?? null,
		zielkonto: (z.zielkonto as string | null) ?? null,
		wkn: (z.wkn as string | null) ?? null,
		aktiv: z.aktiv == null ? true : Boolean(z.aktiv),
		actualKategorie: (z.actual_kategorie as string | null) ?? null,
		standCent: z.stand_cent == null ? null : Number(z.stand_cent),
		standDatum: (z.stand_datum as string | null) ?? null
	}));
}

/** Ältere Sicherungen kennen nur Name, Betrag und Zielkonto. */
export function vervollstaendigeRueckstellung(r: Partial<RueckstellungEintrag> & Pick<RueckstellungEintrag, 'person' | 'name' | 'betragCent'>): RueckstellungEintrag {
	return {
		art: 'fest',
		zielCent: null,
		zielNettoFaktor: null,
		faellig: null,
		zielkonto: null,
		wkn: null,
		aktiv: true,
		actualKategorie: null,
		standCent: null,
		standDatum: null,
		...r
	};
}

function schreibeRueckstellungen(person: PersonId, liste: RueckstellungEintrag[]) {
	db().prepare('DELETE FROM rueckstellungen WHERE person = ?').run(person);
	for (const r of liste) {
		db()
			.prepare(
				`INSERT INTO rueckstellungen (person, name, art, betrag_cent, ziel_cent, ziel_netto_faktor, faellig, zielkonto, wkn, aktiv, actual_kategorie, stand_cent, stand_datum)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				person,
				r.name,
				r.art,
				r.betragCent,
				r.zielCent,
				r.zielNettoFaktor,
				r.faellig,
				r.zielkonto,
				r.wkn,
				r.aktiv ? 1 : 0,
				r.actualKategorie,
				r.standCent,
				r.standDatum
			);
	}
}

export function speichereRueckstellungen(person: PersonId, liste: RueckstellungEintrag[], wer: PersonId) {
	return inTransaktion(() => {
		const vorher = ladeRueckstellungen(person);
		schreibeRueckstellungen(person, liste);
		return protokolliere(wer, `person-${person}`, 'Rücklagen geändert', { typ: 'rueckstellungen', person, vorher });
	});
}

// ---------- Gemeinschaftskonto ----------

const json = <T>(wert: unknown): T | null => (wert ? (JSON.parse(wert as string) as T) : null);

export function ladeGemeinschaft(): GemeinschaftEintrag {
	const z = db().prepare('SELECT * FROM gemeinschaft WHERE id = 1').get() as Zeile;
	const positionen = (
		db().prepare('SELECT * FROM gemeinschaft_positionen ORDER BY sortierung, id').all() as Zeile[]
	).map((p) => ({
		id: Number(p.id),
		name: p.name as string,
		art: p.art as PositionEintrag['art'],
		betragCent: Number(p.betrag_cent),
		ausgang: json<Ausgang>(p.ausgang),
		kategorie: { a: (p.kategorie_a as string | null) ?? null, b: (p.kategorie_b as string | null) ?? null }
	}));
	return { positionen, modell: z.modell as Aufteilungsmodell, rundung: json<Rundung>(z.rundung) };
}

function schreibeGemeinschaft(g: Partial<GemeinschaftEintrag>) {
	if (g.modell !== undefined || g.rundung !== undefined) {
		const vorher = ladeGemeinschaft();
		db()
			.prepare('UPDATE gemeinschaft SET modell = ?, rundung = ? WHERE id = 1')
			.run(g.modell ?? vorher.modell, JSON.stringify(g.rundung === undefined ? vorher.rundung : g.rundung));
	}
	if (g.positionen) {
		db().exec('DELETE FROM gemeinschaft_positionen');
		const einf = db().prepare(
			`INSERT INTO gemeinschaft_positionen (name, art, betrag_cent, ausgang, kategorie_a, kategorie_b, sortierung)
			VALUES (?, ?, ?, ?, ?, ?, ?)`
		);
		g.positionen.forEach((p, i) =>
			einf.run(
				p.name,
				p.art,
				p.betragCent,
				p.ausgang ? JSON.stringify(p.ausgang) : null,
				p.kategorie?.a ?? null,
				p.kategorie?.b ?? null,
				i
			)
		);
	}
}

/** Positionen aus einer Sicherung der ersten Version (Miete, Alltag, Rücklage). */
function positionenAusAlt(g: Record<string, unknown>): PositionEintrag[] {
	const zahl = (k: string) => Number(g[k] ?? 0);
	const ohne = { a: null, b: null };
	return [
		{ name: 'Miete', art: 'fest', betragCent: zahl('mieteCent'), ausgang: { art: 'ueberweisung', ziel: 'Vermieter', tag: 1 }, kategorie: ohne },
		{ name: 'Lebensmittel und Alltag', art: 'fest', betragCent: zahl('alltagCent'), ausgang: null, kategorie: ohne },
		{ name: 'Gemeinsame Rücklage', art: 'fest', betragCent: zahl('ruecklageCent'), ausgang: { art: 'umbuchung', ziel: 'Gemeinschaftstagesgeld', tag: null }, kategorie: ohne },
		{ name: 'Gemeinsame Fixkosten', art: 'fixkosten', betragCent: 0, ausgang: null, kategorie: ohne }
	];
}

// ---------- Daueraufträge ----------

function schreibeAuftraege(person: PersonId, liste: AuftragKonfig[]) {
	db().prepare('DELETE FROM dauerauftraege WHERE person = ?').run(person);
	const einf = db().prepare(
		'INSERT INTO dauerauftraege (person, name, zielkonto, bausteine, rundung, sortierung) VALUES (?, ?, ?, ?, ?, ?)'
	);
	liste.forEach((a, i) =>
		einf.run(person, a.name, a.zielkonto, JSON.stringify(a.bausteine), a.rundung ? JSON.stringify(a.rundung) : null, i)
	);
	db().prepare('INSERT OR REPLACE INTO merker (schluessel, wert) VALUES (?, ?)').run(`auftraege-${person}`, '1');
}

/** Die Daueraufträge der Person. Die Standard-Aufträge legt die Migration beim Start an. */
export function ladeAuftraege(person: PersonId): AuftragEintrag[] {
	const zeilen = db().prepare('SELECT * FROM dauerauftraege WHERE person = ? ORDER BY sortierung, id').all(person) as Zeile[];
	return zeilen.map((z) => ({
		id: Number(z.id),
		name: z.name as string,
		zielkonto: z.zielkonto as string,
		bausteine: JSON.parse(z.bausteine as string) as Baustein[],
		rundung: json<Rundung>(z.rundung)
	}));
}

export function speichereAuftraege(person: PersonId, liste: AuftragKonfig[], wer: PersonId, text = 'Daueraufträge geändert') {
	return inTransaktion(() => {
		const vorher = ladeAuftraege(person);
		schreibeAuftraege(person, liste);
		return protokolliere(wer, `person-${person}`, text, { typ: 'auftraege', person, vorher });
	});
}

/** Wechselt das Kontenmodell und passt die Daueraufträge an, in einem Schritt (auch beim Rückgängigmachen). */
export function aendereModus(person: PersonId, modus: Kontenmodus, auftraege: AuftragKonfig[], wer: PersonId) {
	return inTransaktion(() => {
		const vorher = ladePerson(person);
		const auftraegeVorher = ladeAuftraege(person);
		schreibePerson({ ...vorher, modus });
		schreibeAuftraege(person, auftraege);
		return protokolliere(wer, `person-${person}`, 'Kontenmodell geändert, Daueraufträge angepasst', {
			typ: 'modus',
			vorher,
			auftraege: auftraegeVorher
		});
	});
}

export function aendereGemeinschaft(teil: Partial<GemeinschaftEintrag>, wer: PersonId, text: string) {
	return inTransaktion(() => {
		const vorher = ladeGemeinschaft();
		schreibeGemeinschaft({ ...vorher, ...teil });
		return protokolliere(wer, 'gemeinsam', text, { typ: 'gemeinschaft', vorher });
	});
}

// ---------- Protokoll und Rückgängig ----------

function protokolliere(wer: PersonId, bereich: string, text: string, rueckgaengig: Rueckgaengig | null): number {
	const r = db()
		.prepare('INSERT INTO aenderungen (zeit, person, bereich, text, rueckgaengig) VALUES (?, ?, ?, ?, ?)')
		.run(new Date().toISOString(), wer, bereich, text, rueckgaengig ? JSON.stringify(rueckgaengig) : null);
	// Nur die letzten 200 Einträge behalten.
	db().exec('DELETE FROM aenderungen WHERE id <= (SELECT MAX(id) - 200 FROM aenderungen)');
	return Number(r.lastInsertRowid);
}

export function letzteAenderung(bereich: string): Aenderung | null {
	const z = db()
		.prepare('SELECT * FROM aenderungen WHERE bereich = ? ORDER BY id DESC LIMIT 1')
		.get(bereich) as Zeile | undefined;
	return z ? zuAenderung(z) : null;
}

export function letzteAenderungen(anzahl = 20): Aenderung[] {
	return (db().prepare('SELECT * FROM aenderungen ORDER BY id DESC LIMIT ?').all(anzahl) as Zeile[]).map(
		zuAenderung
	);
}

function zuAenderung(z: Zeile): Aenderung {
	return {
		id: Number(z.id),
		zeit: z.zeit as string,
		person: z.person as PersonId,
		bereich: z.bereich as string,
		text: z.text as string,
		kannRueckgaengig: z.rueckgaengig != null && nochAnwendbar(JSON.parse(z.rueckgaengig as string) as Rueckgaengig, z.text as string)
	};
}

/**
 * Einträge aus älteren Versionen, die sich nicht mehr sinnvoll anwenden lassen: Gemeinschaft ohne Positionen
 * (erste Version) und Kontenmodell-Wechsel, die damals als zwei getrennte Einträge gespeichert wurden.
 */
function nochAnwendbar(r: Rueckgaengig, text: string): boolean {
	if (r.typ === 'gemeinschaft') return Array.isArray(r.vorher.positionen);
	if (r.typ === 'person') return text !== 'Kontenmodell geändert';
	if (r.typ === 'auftraege') return text !== 'Daueraufträge an Kontenmodell angepasst';
	return true;
}

/** Der Eintrag ist zu alt, um ihn noch anzuwenden; er bleibt im Verlauf offen. */
export class NichtMehrRueckgaengig extends Error {
	constructor() {
		super('Diese Änderung lässt sich nicht mehr rückgängig machen.');
	}
}

/** Text der neuen Verlaufszeile, null wenn der Eintrag fehlt oder schon rückgängig gemacht ist. Wirft NichtMehrRueckgaengig. */
export function macheRueckgaengig(id: number, wer: PersonId): string | null {
	return inTransaktion(() => {
		const z = db().prepare('SELECT * FROM aenderungen WHERE id = ?').get(id) as Zeile | undefined;
		if (!z || z.rueckgaengig == null) return null;
		const r = JSON.parse(z.rueckgaengig as string) as Rueckgaengig;
		// Der Eintrag bleibt im Verlauf offen, damit nichts still verloren geht.
		if (!nochAnwendbar(r, z.text as string)) throw new NichtMehrRueckgaengig();
		switch (r.typ) {
			case 'posten':
				if (r.vorher) schreibePosten(r.vorher, r.id);
				else db().prepare('DELETE FROM posten WHERE id = ?').run(r.id);
				break;
			case 'person':
				schreibePerson(r.vorher);
				break;
			case 'gemeinschaft':
				schreibeGemeinschaft(r.vorher);
				break;
			case 'auftraege':
				schreibeAuftraege(r.person, r.vorher);
				break;
			case 'modus':
				// Nur das Kontenmodell zurück; Netto, Kontostand usw. können sich inzwischen geändert haben.
				schreibePerson({ ...ladePerson(r.vorher.id), modus: r.vorher.modus });
				schreibeAuftraege(r.vorher.id, r.auftraege);
				break;
			case 'rueckstellungen':
				schreibeRueckstellungen(r.person, r.vorher);
				break;
			case 'ausblendung':
				schreibeAusblendung(r.person, r.hinweis, r.warAusgeblendet);
				break;
		}
		db().prepare('UPDATE aenderungen SET rueckgaengig = NULL WHERE id = ?').run(id);
		const text = `Rückgängig: ${z.text as string}`;
		db()
			.prepare('INSERT INTO aenderungen (zeit, person, bereich, text) VALUES (?, ?, ?, ?)')
			.run(new Date().toISOString(), wer, z.bereich as string, text);
		return text;
	});
}

// ---------- Export und Import ----------

export interface Sicherung {
	version: 1;
	erstellt: string;
	personen: Person[];
	posten: PostenEintrag[];
	rueckstellungen: RueckstellungEintrag[];
	gemeinschaft: GemeinschaftEintrag;
	auftraege?: { a: AuftragKonfig[]; b: AuftragKonfig[] };
	ausblendungen?: { a: Ausblendung[]; b: Ausblendung[] };
}

export function exportiere(): Sicherung {
	return {
		version: 1,
		erstellt: new Date().toISOString(),
		personen: ladePersonen(),
		posten: (['a', 'b', 'gemeinsam'] as const).flatMap((b) => ladePosten(b)),
		rueckstellungen: [...ladeRueckstellungen('a'), ...ladeRueckstellungen('b')],
		gemeinschaft: ladeGemeinschaft(),
		auftraege: { a: ladeAuftraege('a'), b: ladeAuftraege('b') },
		ausblendungen: { a: ladeAusblendungen('a'), b: ladeAusblendungen('b') }
	};
}

export function importiere(s: Sicherung, wer: PersonId) {
	if (s?.version !== 1 || !Array.isArray(s.personen) || !Array.isArray(s.posten)) {
		throw new Error('Die Datei ist keine Sicherung dieser App.');
	}
	// Erst alles prüfen, dann schreiben: eine ungültige Sicherung ändert nichts.
	const auftraege: Partial<Record<PersonId, AuftragKonfig[]>> = {};
	const umbenannt: string[] = [];
	for (const id of ['a', 'b'] as const) {
		const liste = s.auftraege?.[id];
		if (liste == null) continue;
		// Ältere Stände konnten doppelte Namen erzeugen; die eigene Sicherung soll trotzdem wiederherstellbar sein.
		// Nur echte Texte umbenennen, alles andere fängt die Prüfung ab.
		const eindeutig =
			Array.isArray(liste) && liste.every((a) => typeof a?.name === 'string') ? eindeutigeNamen(liste) : liste;
		if (Array.isArray(eindeutig)) {
			eindeutig.forEach((a, i) => {
				if (a.name !== (liste as AuftragKonfig[])[i].name) umbenannt.push(`„${(liste as AuftragKonfig[])[i].name.trim()}“ → „${a.name}“`);
			});
		}
		const wkns = (s.rueckstellungen ?? []).flatMap((r) => (r?.person === id && typeof r.wkn === 'string' && r.wkn ? [r.wkn] : []));
		const ergebnis = pruefeAuftraege(eindeutig, wkns);
		if ('fehler' in ergebnis) {
			const name = s.personen.find((p) => p?.id === id)?.name ?? id;
			throw new Error(`Die Sicherung enthält ungültige Daueraufträge von ${name}: ${Object.values(ergebnis.fehler)[0]}`);
		}
		auftraege[id] = ergebnis.auftraege;
	}
	const vertraege = s.posten.map((p, i) => {
		const ergebnis = pruefeVertrag((p as { vertrag?: unknown })?.vertrag);
		if ('fehler' in ergebnis) {
			throw new Error(`Die Sicherung enthält ungültige Vertragsangaben bei „${p?.name ?? `Posten ${i + 1}`}“: ${Object.values(ergebnis.fehler)[0]}`);
		}
		return ergebnis.vertrag;
	});
	inTransaktion(() => {
		db().exec('DELETE FROM beteiligungen; DELETE FROM posten; DELETE FROM rueckstellungen;');
		for (const p of s.personen) {
			if (p.id === 'a' || p.id === 'b') schreibePerson({ ...ladePerson(p.id), ...p });
		}
		// Unbekannte Symbole verwerfen, der Posten zeigt dann wieder den Anfangsbuchstaben.
		s.posten.forEach((p, i) =>
			schreibePosten({ ...p, icon: istPostenIcon(p.icon) ? p.icon : null, vertrag: vertraege[i], beteiligungen: p.beteiligungen ?? [] })
		);
		for (const id of ['a', 'b'] as const) {
			schreibeRueckstellungen(id, (s.rueckstellungen ?? []).filter((r) => r.person === id).map(vervollstaendigeRueckstellung));
		}
		if (s.gemeinschaft) {
			const g = s.gemeinschaft as GemeinschaftEintrag & Record<string, unknown>;
			schreibeGemeinschaft({
				modell: g.modell ?? 'A',
				rundung: g.rundung ?? null,
				positionen: Array.isArray(g.positionen) ? g.positionen : positionenAusAlt(g)
			});
		}
		for (const id of ['a', 'b'] as const) {
			const liste = auftraege[id];
			if (liste) schreibeAuftraege(id, liste);
			else {
				// Ältere Sicherung: Daueraufträge aus den eingespielten Einstellungen neu anlegen.
				db().prepare('DELETE FROM dauerauftraege WHERE person = ?').run(id);
				db().prepare('DELETE FROM merker WHERE schluessel = ?').run(`auftraege-${id}`);
				legeAuftraegeAn(db(), id);
			}
		}
		// Ältere Sicherungen kennen keine Ausblendungen: dann bleiben die vorhandenen stehen.
		for (const id of ['a', 'b'] as const) {
			const liste = s.ausblendungen?.[id];
			if (!Array.isArray(liste)) continue;
			db().prepare('DELETE FROM ausgeblendete_hinweise WHERE person = ?').run(id);
			for (const h of liste) {
				if (typeof h?.terminplan === 'string' && h.terminplan && AUSBLENDBARE_ARTEN.has(h.art)) schreibeAusblendung(id, h, true);
			}
		}
		db().exec('DELETE FROM aenderungen');
		db()
			.prepare('INSERT INTO aenderungen (zeit, person, bereich, text) VALUES (?, ?, ?, ?)')
			.run(new Date().toISOString(), wer, 'system', 'Sicherung eingespielt');
	});
	/** Daueraufträge, die wegen doppelter Namen einen Zusatz bekommen haben. */
	return { umbenannt };
}
