import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { env } from 'node:process';
import type { Buchung } from '#lib/rechnung/abgleich.ts';
import type { Terminplan } from '#lib/rechnung/terminplan.ts';
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

export interface ActualKategorie {
	id: string;
	name: string;
	gruppe: string;
	einnahme: boolean;
}

/** Alles, was ein Abruf liefert; wird als Schnappschuss gespeichert. */
export interface ActualDaten {
	saldoCent: number;
	/** Buchungen des gewählten Kontos seit dem Monatsersten. */
	buchungen: Buchung[];
	terminplaene: Terminplan[];
	kategorien: ActualKategorie[];
	/** Letzte Gutschrift je Kategorie im gewählten Konto, für die Prüfung der Gehaltskategorie. */
	letzteEinnahmen: Record<string, string>;
}

type RohTerminplan = Awaited<ReturnType<Api['getSchedules']>>[number];
type RohBuchung = Awaited<ReturnType<Api['getTransactions']>>[number];

function betragAus(roh: RohTerminplan): { cent: number; art: Terminplan['betragArt'] } {
	const a = roh.amount;
	if (typeof a === 'object' && a) {
		// Bei „zwischen“ mit dem größeren Betrag rechnen, damit die Rücklage reicht.
		const groesser = Math.abs(a.num1) >= Math.abs(a.num2) ? a.num1 : a.num2;
		return { cent: -groesser, art: 'spanne' };
	}
	return { cent: -(a ?? 0), art: roh.amountOp === 'isapprox' ? 'ungefaehr' : 'fest' };
}

function rhythmusAus(roh: RohTerminplan): Terminplan['rhythmus'] {
	const d = roh.date;
	if (!d || typeof d === 'string') return null;
	return { frequenz: d.frequency, intervall: d.interval ?? 1, muster: !!d.patterns?.length };
}

const isoTag = (d: Date) => d.toISOString().slice(0, 10);

export function ladeAbgleich(
	id: PersonId,
	kontoId: string,
	stichtag: string
): Promise<ActualDaten> {
	return mitBudget(id, async (api) => {
		const konten = await api.getAccounts();
		if (!konten.some((k) => k.id === kontoId)) {
			throw new ActualFehler('Das gewählte Konto gibt es in Actual nicht mehr. Bitte wähl es neu.');
		}
		const kontoName = new Map(konten.map((k) => [k.id, k.name]));
		const payees = await api.getPayees();
		const payeeName = new Map(payees.map((p) => [p.id, p.name]));
		const umbuchungsPayee = new Set(payees.filter((p) => p.transfer_acct).map((p) => p.id));
		const regeln = new Map((await api.getRules()).map((r) => [r.id, r]));

		const gruppen = await api.getCategoryGroups();
		const kategorien: ActualKategorie[] = gruppen.flatMap((g) =>
			(g.categories ?? [])
				.filter((k) => !k.hidden)
				.map((k) => ({ id: k.id, name: k.name, gruppe: g.name, einnahme: Boolean(g.is_income) }))
		);

		const saldoCent = await api.getAccountBalance(kontoId, new Date(`${stichtag}T12:00:00`));
		const rohTerminplaene = await api.getSchedules();

		// Buchungen eines Jahres auf allen Konten mit Terminplänen: für die letzte Buchung je Terminplan.
		const jahrZurueck = new Date(`${stichtag}T12:00:00`);
		jahrZurueck.setMonth(jahrZurueck.getMonth() - 13);
		const kontenMitPlan = new Set([kontoId, ...rohTerminplaene.map((t) => t.account).filter(Boolean)] as string[]);
		const buchungenJeKonto = new Map<string, RohBuchung[]>();
		for (const k of kontenMitPlan) {
			if (!kontoName.has(k)) continue;
			buchungenJeKonto.set(k, (await api.getTransactions(k, isoTag(jahrZurueck), stichtag)).filter((t) => !t.is_child));
		}
		const letzteJePlan = new Map<string, RohBuchung>();
		for (const liste of buchungenJeKonto.values()) {
			for (const t of liste) {
				if (!t.schedule) continue;
				const bisher = letzteJePlan.get(t.schedule);
				if (!bisher || t.date > bisher.date) letzteJePlan.set(t.schedule, t);
			}
		}

		const terminplaene: Terminplan[] = rohTerminplaene
			.filter((t) => !(t as { tombstone?: boolean }).tombstone)
			.map((t) => {
				const { cent, art } = betragAus(t);
				const regel = t.rule ? regeln.get(t.rule) : undefined;
				const kategorie = regel?.actions?.find(
					(a) => a.op === 'set' && a.field === 'category' && !(a.options as { splitIndex?: number } | undefined)?.splitIndex
				);
				const letzte = letzteJePlan.get(t.id);
				const empfaenger = t.payee ? (payeeName.get(t.payee) ?? null) : null;
				return {
					id: t.id,
					name: t.name || empfaenger || 'Ohne Namen',
					kontoId: t.account ?? null,
					kontoName: t.account ? (kontoName.get(t.account) ?? null) : null,
					empfaenger,
					umbuchung: !!t.payee && umbuchungsPayee.has(t.payee),
					betragCent: cent,
					betragArt: art,
					rhythmus: rhythmusAus(t),
					naechsterTermin: t.next_date ?? null,
					beendet: !!t.completed,
					kategorieId: (kategorie?.value as string | undefined) ?? null,
					letzteBuchung: letzte ? { datum: letzte.date, betragCent: -letzte.amount } : null
				};
			});

		const monatsErster = `${stichtag.slice(0, 8)}01`;
		const imKonto = buchungenJeKonto.get(kontoId) ?? [];
		const buchungen: Buchung[] = imKonto
			.filter((t) => t.date >= monatsErster)
			.map((t) => ({
				datum: t.date,
				betragCent: t.amount,
				text: (t.payee && payeeName.get(t.payee)) || t.imported_payee || t.notes || '',
				kategorie: t.category ?? null,
				terminplan: t.schedule ?? null
			}));
		const letzteEinnahmen: Record<string, string> = {};
		for (const t of imKonto) {
			if (t.amount > 0 && t.category && (letzteEinnahmen[t.category] ?? '') < t.date) letzteEinnahmen[t.category] = t.date;
		}

		return { saldoCent, buchungen, terminplaene, kategorien, letzteEinnahmen };
	});
}
