import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Jeder Test braucht ein frisches Modul, weil db() die Verbindung zwischenspeichert.
const ladeDb = async () => {
	vi.resetModules();
	return import('./db');
};

let ordner: string;
beforeEach(() => {
	ordner = mkdtempSync(join(tmpdir(), 'fixkosten-test-'));
	vi.stubEnv('DATA_DIR', ordner);
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.doUnmock('node:fs');
	rmSync(ordner, { recursive: true, force: true });
});

describe('Fehler beim Öffnen des Datenordners', () => {
	it('meldet EACCES beim Anlegen des Ordners als Datenordner-Problem', async () => {
		vi.doMock('node:fs', async (original) => ({
			...(await original<typeof import('node:fs')>()),
			mkdirSync: () => {
				throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
			}
		}));
		const { db, DatenordnerFehler } = await ladeDb();
		expect(() => db()).toThrow(DatenordnerFehler);
	});

	it('gibt einen SQL-Fehler bei der Migration unverändert weiter', async () => {
		// Eine Tabelle „personen“ ohne die erwarteten Spalten lässt das Schema scheitern.
		const alt = new DatabaseSync(join(ordner, 'fixkosten.db'));
		alt.exec('CREATE TABLE personen (x)');
		alt.close();
		const { db, DatenordnerFehler } = await ladeDb();
		let fehler: unknown;
		try {
			db();
		} catch (e) {
			fehler = e;
		}
		expect(fehler).toBeInstanceOf(Error);
		expect(fehler).not.toBeInstanceOf(DatenordnerFehler);
		expect((fehler as { code?: string }).code).toBe('ERR_SQLITE_ERROR');
	});

	it('erkennt schreibgeschützte und nicht zu öffnende Datenbanken', async () => {
		const { istZugriffsfehler } = await ladeDb();
		expect(istZugriffsfehler({ code: 'ERR_SQLITE_ERROR', errcode: 8 })).toBe(true);
		expect(istZugriffsfehler({ code: 'ERR_SQLITE_ERROR', errcode: 14 })).toBe(true);
		expect(istZugriffsfehler({ code: 'ERR_SQLITE_ERROR', errcode: 1032 })).toBe(true); // SQLITE_READONLY_DBMOVED
		expect(istZugriffsfehler({ code: 'ERR_SQLITE_ERROR', errcode: 1 })).toBe(false);
		expect(istZugriffsfehler({ code: 'EROFS' })).toBe(true);
	});
});

describe('Healthcheck', () => {
	it('liefert 200, solange die Datenbank geht', async () => {
		await ladeDb();
		const { GET } = await import('../../routes/api/health/+server');
		const antwort = GET();
		expect(antwort.status).toBe(200);
		expect(await antwort.json()).toEqual({ status: 'ok' });
	});

	it('liefert 503 ohne Details, wenn die Datenbank nicht geht', async () => {
		vi.doMock('node:fs', async (original) => ({
			...(await original<typeof import('node:fs')>()),
			mkdirSync: () => {
				throw Object.assign(new Error(`EACCES: ${ordner}`), { code: 'EACCES' });
			}
		}));
		await ladeDb();
		const fehlerLog = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { GET } = await import('../../routes/api/health/+server');
		const antwort = GET();
		expect(antwort.status).toBe(503);
		expect(await antwort.json()).toEqual({ status: 'fehler' });
		fehlerLog.mockRestore();
	});
});
