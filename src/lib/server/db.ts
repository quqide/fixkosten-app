import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { standardAuftraege } from '#lib/rechnung/aufstellung.ts';
import { zielVon } from '#lib/rechnung/rueckstellung.ts';

export type PersonId = 'a' | 'b';
/** Besitzer eines Postens: eine Person oder beide gemeinsam. */
export type Besitzer = PersonId | 'gemeinsam';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS personen (
	id TEXT PRIMARY KEY CHECK (id IN ('a', 'b')),
	name TEXT NOT NULL,
	netto_cent INTEGER NOT NULL DEFAULT 0,
	etf_prozent REAL NOT NULL DEFAULT 0,
	ueberweisungstag INTEGER NOT NULL DEFAULT 1,
	modus INTEGER NOT NULL DEFAULT 1,
	puffer_cent INTEGER NOT NULL DEFAULT 2500,
	ist_cent INTEGER,
	ist_datum TEXT,
	ist_ausstehend INTEGER NOT NULL DEFAULT 0,
	theme TEXT NOT NULL DEFAULT 'salbei',
	hell TEXT NOT NULL DEFAULT 'auto'
);
CREATE TABLE IF NOT EXISTS posten (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	besitzer TEXT NOT NULL CHECK (besitzer IN ('a', 'b', 'gemeinsam')),
	name TEXT NOT NULL,
	intervall INTEGER NOT NULL,
	betrag_cent INTEGER NOT NULL,
	art TEXT,
	abbuchungsart TEXT,
	buchungsdatum TEXT
);
CREATE TABLE IF NOT EXISTS beteiligungen (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	posten_id INTEGER NOT NULL REFERENCES posten(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	betrag_cent INTEGER NOT NULL,
	eingangstag INTEGER
);
CREATE TABLE IF NOT EXISTS rueckstellungen (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	person TEXT NOT NULL CHECK (person IN ('a', 'b')),
	name TEXT NOT NULL,
	betrag_cent INTEGER NOT NULL,
	zielkonto TEXT
);
CREATE TABLE IF NOT EXISTS gemeinschaft (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	miete_cent INTEGER NOT NULL DEFAULT 0,
	alltag_cent INTEGER NOT NULL DEFAULT 0,
	ruecklage_cent INTEGER NOT NULL DEFAULT 0,
	modell TEXT NOT NULL DEFAULT 'A'
);
CREATE TABLE IF NOT EXISTS aenderungen (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	zeit TEXT NOT NULL,
	person TEXT NOT NULL,
	bereich TEXT NOT NULL,
	text TEXT NOT NULL,
	rueckgaengig TEXT
);
CREATE TABLE IF NOT EXISTS gemeinschaft_positionen (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	art TEXT NOT NULL CHECK (art IN ('fest', 'fixkosten')),
	betrag_cent INTEGER NOT NULL DEFAULT 0,
	ausgang TEXT,
	kategorie_a TEXT,
	kategorie_b TEXT,
	sortierung INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS dauerauftraege (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	person TEXT NOT NULL CHECK (person IN ('a', 'b')),
	name TEXT NOT NULL,
	zielkonto TEXT NOT NULL DEFAULT '',
	bausteine TEXT NOT NULL,
	rundung TEXT,
	sortierung INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS merker (
	schluessel TEXT PRIMARY KEY,
	wert TEXT
);
CREATE TABLE IF NOT EXISTS actual_stand (
	person TEXT PRIMARY KEY CHECK (person IN ('a', 'b')),
	zeit TEXT NOT NULL,
	daten TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS actual_zuordnung (
	person TEXT NOT NULL CHECK (person IN ('a', 'b')),
	terminplan TEXT NOT NULL,
	rolle TEXT NOT NULL CHECK (rolle IN ('fixkosten', 'dauerauftrag', 'ignorieren')),
	dauerauftrag TEXT,
	PRIMARY KEY (person, terminplan)
);
CREATE TABLE IF NOT EXISTS ausgeblendete_hinweise (
	person TEXT NOT NULL CHECK (person IN ('a', 'b')),
	terminplan TEXT NOT NULL,
	art TEXT NOT NULL,
	PRIMARY KEY (person, terminplan, art)
);
INSERT OR IGNORE INTO personen (id, name, ueberweisungstag) VALUES ('a', 'Person 1', 7), ('b', 'Person 2', 7);
INSERT OR IGNORE INTO gemeinschaft (id) VALUES (1);
`;

/**
 * Führt fn in einer Transaktion aus. Scheitert auch das ROLLBACK (z. B. weil SQLite die Transaktion
 * schon selbst beendet hat), bleibt der eigentliche Fehler sichtbar.
 */
export function transaktion<T>(db: DatabaseSync, fn: () => T): T {
	db.exec('BEGIN');
	try {
		const ergebnis = fn();
		db.exec('COMMIT');
		return ergebnis;
	} catch (e) {
		try {
			db.exec('ROLLBACK');
		} catch (r) {
			console.error('ROLLBACK fehlgeschlagen', r);
		}
		throw e;
	}
}

export function oeffneDatenbank(pfad: string): DatabaseSync {
	const db = new DatabaseSync(pfad);
	try {
		db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
		db.exec(SCHEMA);
		ergaenzeSpalten(db);
		legePositionenAn(db);
		transaktion(db, () => {
			for (const person of ['a', 'b'] as const) legeAuftraegeAn(db, person);
		});
		return db;
	} catch (e) {
		db.close();
		throw e;
	}
}

/** Spalten, die nach der ersten Version dazukamen. */
const NEUE_SPALTEN: [tabelle: string, spalte: string, definition: string][] = [
	['personen', 'ist_quelle', "TEXT NOT NULL DEFAULT 'hand'"],
	['personen', 'abgleich', 'TEXT'],
	['personen', 'actual_konto_id', 'TEXT'],
	['personen', 'actual_konto_name', 'TEXT'],
	['personen', 'actual_gehalt_kategorie', 'TEXT'],
	['posten', 'actual_terminplan', 'TEXT'],
	['gemeinschaft', 'rundung', 'TEXT'],
	['rueckstellungen', 'art', "TEXT NOT NULL DEFAULT 'fest'"],
	['rueckstellungen', 'ziel_cent', 'INTEGER'],
	['rueckstellungen', 'ziel_netto_faktor', 'REAL'],
	['rueckstellungen', 'faellig', 'TEXT'],
	['rueckstellungen', 'wkn', 'TEXT'],
	['rueckstellungen', 'aktiv', 'INTEGER NOT NULL DEFAULT 1'],
	['rueckstellungen', 'actual_kategorie', 'TEXT'],
	['rueckstellungen', 'stand_cent', 'INTEGER'],
	['rueckstellungen', 'stand_datum', 'TEXT'],
	['posten', 'icon', 'TEXT'],
	['posten', 'vertrag_ende', 'TEXT'],
	['posten', 'kuendigung_anzahl', 'INTEGER'],
	['posten', 'kuendigung_einheit', 'TEXT'],
	['posten', 'verlaengerung_monate', 'INTEGER'],
	['posten', 'kundennummer', 'TEXT'],
	['posten', 'notiz', 'TEXT']
];

function ergaenzeSpalten(db: DatabaseSync) {
	for (const [tabelle, spalte, definition] of NEUE_SPALTEN) {
		const vorhanden = (db.prepare(`PRAGMA table_info(${tabelle})`).all() as { name: string }[]).some(
			(s) => s.name === spalte
		);
		if (!vorhanden) db.exec(`ALTER TABLE ${tabelle} ADD COLUMN ${spalte} ${definition}`);
	}
}

/** Einmalig: aus Miete, Alltag und Rücklage der ersten Version frei bearbeitbare Positionen machen. */
function legePositionenAn(db: DatabaseSync) {
	if (db.prepare("SELECT 1 FROM merker WHERE schluessel = 'positionen'").get()) return;
	transaktion(db, () => {
		const g = db.prepare('SELECT * FROM gemeinschaft WHERE id = 1').get() as Record<string, number>;
		const einf = db.prepare(
			'INSERT INTO gemeinschaft_positionen (name, art, betrag_cent, ausgang, sortierung) VALUES (?, ?, ?, ?, ?)'
		);
		if (!(db.prepare('SELECT COUNT(*) AS n FROM gemeinschaft_positionen').get() as { n: number }).n) {
			einf.run('Miete', 'fest', g.miete_cent ?? 0, JSON.stringify({ art: 'ueberweisung', ziel: 'Vermieter', tag: 1 }), 0);
			einf.run('Lebensmittel und Alltag', 'fest', g.alltag_cent ?? 0, null, 1);
			einf.run('Gemeinsame Rücklage', 'fest', g.ruecklage_cent ?? 0, JSON.stringify({ art: 'umbuchung', ziel: 'Gemeinschaftstagesgeld', tag: null }), 2);
			einf.run('Gemeinsame Fixkosten', 'fixkosten', 0, null, 3);
		}
		db.prepare("INSERT INTO merker (schluessel, wert) VALUES ('positionen', '1')").run();
	});
}

/**
 * Einmalig je Person: Standard-Daueraufträge aus Kontenmodell, ETF-Anteil und Rückstellungen anlegen.
 * Läuft beim Start und nach dem Einspielen einer Sicherung ohne Daueraufträge, jeweils in einer Transaktion des Aufrufers.
 */
export function legeAuftraegeAn(db: DatabaseSync, person: 'a' | 'b') {
	const merker = `auftraege-${person}`;
	if (db.prepare('SELECT 1 FROM merker WHERE schluessel = ?').get(merker)) return;
	if (db.prepare('SELECT 1 FROM dauerauftraege WHERE person = ?').get(person)) {
		db.prepare('INSERT INTO merker (schluessel, wert) VALUES (?, ?)').run(merker, '1');
		return;
	}
	const p = db.prepare('SELECT modus, etf_prozent FROM personen WHERE id = ?').get(person) as { modus: number; etf_prozent: number };
	const rueckstellungen = (
		db.prepare('SELECT name, betrag_cent, zielkonto, wkn FROM rueckstellungen WHERE person = ? ORDER BY id').all(person) as {
			name: string;
			betrag_cent: number;
			zielkonto: string | null;
			wkn: string | null;
		}[]
	).map((r) => ({ name: r.name, betragCent: r.betrag_cent, zielkonto: zielVon(r) }));
	const auftraege = standardAuftraege(p.modus === 2 ? 2 : 1, Number(p.etf_prozent), rueckstellungen);
	const einf = db.prepare(
		'INSERT INTO dauerauftraege (person, name, zielkonto, bausteine, rundung, sortierung) VALUES (?, ?, ?, ?, ?, ?)'
	);
	auftraege.forEach((a, i) =>
		einf.run(person, a.name, a.zielkonto, JSON.stringify(a.bausteine), a.rundung ? JSON.stringify(a.rundung) : null, i)
	);
	db.prepare('INSERT INTO merker (schluessel, wert) VALUES (?, ?)').run(merker, '1');
}

/** Der Datenordner fehlt oder ist für den Container nicht beschreibbar. */
export class DatenordnerFehler extends Error {
	constructor(ordner: string, ursache: unknown) {
		const wer = process.getuid ? ` (Benutzer ${process.getuid()}, Gruppe ${process.getgid?.()})` : '';
		super(
			`Die Datenbank in ${ordner} lässt sich nicht öffnen: ${(ursache as Error)?.message ?? ursache}. ` +
				`Der Ordner muss für den Container${wer} beschreibbar sein.`,
			{ cause: ursache }
		);
	}
}

const SQLITE_READONLY = 8;
const SQLITE_CANTOPEN = 14;

/** Fehler, die daran liegen, dass der Datenordner oder die Datei nicht les- oder beschreibbar ist. */
export function istZugriffsfehler(e: unknown): boolean {
	const f = e as { code?: string; errcode?: number } | null;
	if (f?.code === 'EACCES' || f?.code === 'EROFS') return true;
	if (f?.code === 'ERR_SQLITE_ERROR' && typeof f.errcode === 'number') {
		// Erweiterte Fehlercodes tragen den Grundcode im unteren Byte.
		const grund = f.errcode & 0xff;
		return grund === SQLITE_READONLY || grund === SQLITE_CANTOPEN;
	}
	return false;
}

let instanz: DatabaseSync | undefined;

export function db(): DatabaseSync {
	if (!instanz) {
		const ordner = process.env.DATA_DIR ?? 'data';
		try {
			mkdirSync(ordner, { recursive: true });
		} catch (e) {
			throw new DatenordnerFehler(ordner, e);
		}
		try {
			instanz = oeffneDatenbank(join(ordner, 'fixkosten.db'));
		} catch (e) {
			// Nur Zugriffsprobleme liegen am Ordner; SQL- oder Migrationsfehler unverändert weitergeben.
			throw istZugriffsfehler(e) ? new DatenordnerFehler(ordner, e) : e;
		}
	}
	return instanz;
}

/** Für Tests: eine frische Datenbank im Speicher verwenden. */
export function setzeDatenbank(neu: DatabaseSync) {
	instanz = neu;
}
