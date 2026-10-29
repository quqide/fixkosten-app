import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { env } from 'node:process';
import type { Buchung } from '#lib/rechnung/abgleich.ts';
import type { PersonId } from './db.ts';

/**
 * Lesender Zugriff auf Actual Budget. Die Zugangsdaten kommen nur aus
 * Umgebungsvariablen (in Dockge gesetzt), je Person mit eigenem Präfix:
 * ACTUAL_A_URL, ACTUAL_A_PASSWORD, ACTUAL_A_SYNC_ID, optional ACTUAL_A_E2E_PASSWORD.
 */
interface Zugang {
	url: string;
	passwort: string;
	syncId: string;
	e2ePasswort?: string;
}

export interface ActualKonto {
	id: string;
	name: string;
	offbudget: boolean;
}

export interface ActualStand {
	saldoCent: number;
	buchungen: Buchung[];
}

export class ActualFehler extends Error {}

function zugang(id: PersonId): Zugang | null {
	const p = `ACTUAL_${id.toUpperCase()}_`;
	const url = env[`${p}URL`]?.trim();
	const passwort = env[`${p}PASSWORD`];
	const syncId = env[`${p}SYNC_ID`]?.trim();
	if (!url || !passwort || !syncId) return null;
	return { url, passwort, syncId, e2ePasswort: env[`${p}E2E_PASSWORD`] || undefined };
}

export const actualEingerichtet = (id: PersonId) => zugang(id) !== null;

type Api = typeof import('@actual-app/api');

// Die API hält einen globalen Zustand, darum immer nur ein Abruf gleichzeitig.
let warteschlange: Promise<unknown> = Promise.resolve();

function mitBudget<T>(id: PersonId, arbeit: (api: Api) => Promise<T>): Promise<T> {
	const z = zugang(id);
	if (!z) return Promise.reject(new ActualFehler('Actual Budget ist für diese Person nicht eingerichtet.'));
	const lauf = warteschlange.then(async () => {
		const api = await import('@actual-app/api');
		const dataDir = join(env.DATA_DIR ?? 'data', 'actual', id);
		mkdirSync(dataDir, { recursive: true });
		try {
			await api.init({ serverURL: z.url, password: z.passwort, dataDir });
		} catch (e) {
			throw new ActualFehler(`Actual Budget unter ${z.url} ist nicht erreichbar oder das Passwort stimmt nicht.`, {
				cause: e
			});
		}
		try {
			try {
				await api.downloadBudget(z.syncId, z.e2ePasswort ? { password: z.e2ePasswort } : undefined);
			} catch (e) {
				throw new ActualFehler('Das Budget ließ sich nicht laden. Stimmt die Sync-ID?', { cause: e });
			}
			return await arbeit(api);
		} finally {
			await api.shutdown().catch(() => {});
		}
	});
	warteschlange = lauf.catch(() => {});
	return lauf;
}

export function ladeKonten(id: PersonId): Promise<ActualKonto[]> {
	return mitBudget(id, async (api) =>
		(await api.getAccounts())
			.filter((k) => !k.closed)
			.map((k) => ({ id: k.id, name: k.name, offbudget: Boolean(k.offbudget) }))
	);
}

/** Saldo zum Stichtag und die Buchungen seit dem Monatsersten. */
export function ladeStand(id: PersonId, kontoId: string, stichtag: string): Promise<ActualStand> {
	return mitBudget(id, async (api) => {
		const konten = await api.getAccounts();
		if (!konten.some((k) => k.id === kontoId)) {
			throw new ActualFehler('Das gewählte Konto gibt es in Actual nicht mehr. Bitte wähl es neu.');
		}
		const saldoCent = await api.getAccountBalance(kontoId, new Date(`${stichtag}T12:00:00`));
		const payees = new Map((await api.getPayees()).map((p) => [p.id, p.name]));
		const roh = await api.getTransactions(kontoId, `${stichtag.slice(0, 8)}01`, stichtag);
		const buchungen = roh
			.filter((t) => !t.is_child)
			.map((t) => ({
				datum: t.date,
				betragCent: t.amount,
				text: (t.payee && payees.get(t.payee)) || t.imported_payee || t.notes || ''
			}));
		return { saldoCent, buchungen };
	});
}
