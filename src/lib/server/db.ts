import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

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
INSERT OR IGNORE INTO personen (id, name, ueberweisungstag) VALUES ('a', 'Person 1', 7), ('b', 'Person 2', 7);
INSERT OR IGNORE INTO gemeinschaft (id) VALUES (1);
`;

export function oeffneDatenbank(pfad: string): DatabaseSync {
	const db = new DatabaseSync(pfad);
	db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
	db.exec(SCHEMA);
	ergaenzeSpalten(db);
	legePositionenAn(db);
	return db;
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
	['rueckstellungen', 'stand_datum', 'TEXT']
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
}

let instanz: DatabaseSync | undefined;

export function db(): DatabaseSync {
	if (!instanz) {
		const ordner = process.env.DATA_DIR ?? 'data';
		mkdirSync(ordner, { recursive: true });
		instanz = oeffneDatenbank(join(ordner, 'fixkosten.db'));
	}
	return instanz;
}

/** Für Tests: eine frische Datenbank im Speicher verwenden. */
export function setzeDatenbank(neu: DatabaseSync) {
	instanz = neu;
}
