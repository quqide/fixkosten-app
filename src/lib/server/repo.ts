import type { Abbuchungsart, Art, Beteiligung, FixkostenPosten } from '#lib/rechnung/fixkosten.ts';
import type { Aufteilungsmodell } from '#lib/rechnung/gemeinschaft.ts';
import type { Kontenmodus } from '#lib/rechnung/aufstellung.ts';
import type { Abgleich } from '#lib/rechnung/abgleich.ts';
import { db, type Besitzer, type PersonId } from './db.ts';

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
}

export interface RueckstellungEintrag {
	id?: number;
	person: PersonId;
	name: string;
	betragCent: number;
	zielkonto: string | null;
}

export interface GemeinschaftEintrag {
	mieteCent: number;
	alltagCent: number;
	ruecklageCent: number;
	modell: Aufteilungsmodell;
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
	| { typ: 'rueckstellungen'; person: PersonId; vorher: RueckstellungEintrag[] };

type Zeile = Record<string, unknown>;

function inTransaktion<T>(fn: () => T): T {
	const d = db();
	d.exec('BEGIN');
	try {
		const ergebnis = fn();
		d.exec('COMMIT');
		return ergebnis;
	} catch (e) {
		d.exec('ROLLBACK');
		throw e;
	}
}

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
			actual_konto_id = ?, actual_konto_name = ?, theme = ?, hell = ? WHERE id = ?`
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
		beteiligungen: ladeBeteiligungen(Number(z.id))
	};
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
		p.buchungsdatum ?? null
	] as const;
	let postenId: number;
	if (id != null) {
		const vorhanden = db().prepare('SELECT id FROM posten WHERE id = ?').get(id);
		if (vorhanden) {
			db()
				.prepare(
					`UPDATE posten SET besitzer = ?, name = ?, intervall = ?, betrag_cent = ?, art = ?, abbuchungsart = ?,
					buchungsdatum = ? WHERE id = ?`
				)
				.run(...werte, id);
		} else {
			db()
				.prepare(
					`INSERT INTO posten (besitzer, name, intervall, betrag_cent, art, abbuchungsart, buchungsdatum, id)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(...werte, id);
		}
		postenId = id;
	} else {
		const r = db()
			.prepare(
				`INSERT INTO posten (besitzer, name, intervall, betrag_cent, art, abbuchungsart, buchungsdatum)
				VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
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

// ---------- Rückstellungen ----------

export function ladeRueckstellungen(person: PersonId): RueckstellungEintrag[] {
	return (
		db().prepare('SELECT * FROM rueckstellungen WHERE person = ? ORDER BY id').all(person) as Zeile[]
	).map((z) => ({
		id: Number(z.id),
		person,
		name: z.name as string,
		betragCent: Number(z.betrag_cent),
		zielkonto: (z.zielkonto as string | null) ?? null
	}));
}

function schreibeRueckstellungen(person: PersonId, liste: RueckstellungEintrag[]) {
	db().prepare('DELETE FROM rueckstellungen WHERE person = ?').run(person);
	for (const r of liste) {
		db()
			.prepare('INSERT INTO rueckstellungen (person, name, betrag_cent, zielkonto) VALUES (?, ?, ?, ?)')
			.run(person, r.name, r.betragCent, r.zielkonto);
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

export function ladeGemeinschaft(): GemeinschaftEintrag {
	const z = db().prepare('SELECT * FROM gemeinschaft WHERE id = 1').get() as Zeile;
	return {
		mieteCent: Number(z.miete_cent),
		alltagCent: Number(z.alltag_cent),
		ruecklageCent: Number(z.ruecklage_cent),
		modell: z.modell as Aufteilungsmodell
	};
}

function schreibeGemeinschaft(g: GemeinschaftEintrag) {
	db()
		.prepare('UPDATE gemeinschaft SET miete_cent = ?, alltag_cent = ?, ruecklage_cent = ?, modell = ? WHERE id = 1')
		.run(g.mieteCent, g.alltagCent, g.ruecklageCent, g.modell);
}

export function aendereGemeinschaft(teil: Partial<GemeinschaftEintrag>, wer: PersonId, text: string) {
	return inTransaktion(() => {
		const vorher = ladeGemeinschaft();
		schreibeGemeinschaft({ ...vorher, ...teil });
		return protokolliere(wer, 'gemeinsam', text, { typ: 'gemeinschaft', vorher });
	});
}

// ---------- Protokoll und Rückgängig ----------

function protokolliere(wer: PersonId, bereich: string, text: string, rueckgaengig: Rueckgaengig): number {
	const r = db()
		.prepare('INSERT INTO aenderungen (zeit, person, bereich, text, rueckgaengig) VALUES (?, ?, ?, ?, ?)')
		.run(new Date().toISOString(), wer, bereich, text, JSON.stringify(rueckgaengig));
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
		kannRueckgaengig: z.rueckgaengig != null
	};
}

export function macheRueckgaengig(id: number, wer: PersonId): string | null {
	return inTransaktion(() => {
		const z = db().prepare('SELECT * FROM aenderungen WHERE id = ?').get(id) as Zeile | undefined;
		if (!z || z.rueckgaengig == null) return null;
		const r = JSON.parse(z.rueckgaengig as string) as Rueckgaengig;
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
			case 'rueckstellungen':
				schreibeRueckstellungen(r.person, r.vorher);
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
}

export function exportiere(): Sicherung {
	return {
		version: 1,
		erstellt: new Date().toISOString(),
		personen: ladePersonen(),
		posten: (['a', 'b', 'gemeinsam'] as const).flatMap((b) => ladePosten(b)),
		rueckstellungen: [...ladeRueckstellungen('a'), ...ladeRueckstellungen('b')],
		gemeinschaft: ladeGemeinschaft()
	};
}

export function importiere(s: Sicherung, wer: PersonId) {
	if (s?.version !== 1 || !Array.isArray(s.personen) || !Array.isArray(s.posten)) {
		throw new Error('Die Datei ist keine Sicherung dieser App.');
	}
	inTransaktion(() => {
		db().exec('DELETE FROM beteiligungen; DELETE FROM posten; DELETE FROM rueckstellungen;');
		for (const p of s.personen) {
			if (p.id === 'a' || p.id === 'b') schreibePerson({ ...ladePerson(p.id), ...p });
		}
		for (const p of s.posten) schreibePosten({ ...p, beteiligungen: p.beteiligungen ?? [] });
		for (const id of ['a', 'b'] as const) {
			schreibeRueckstellungen(id, (s.rueckstellungen ?? []).filter((r) => r.person === id));
		}
		if (s.gemeinschaft) schreibeGemeinschaft({ ...ladeGemeinschaft(), ...s.gemeinschaft });
		db().exec('DELETE FROM aenderungen');
		db()
			.prepare('INSERT INTO aenderungen (zeit, person, bereich, text) VALUES (?, ?, ?, ?)')
			.run(new Date().toISOString(), wer, 'system', 'Sicherung eingespielt');
	});
}
