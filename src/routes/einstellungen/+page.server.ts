import { fail } from '@sveltejs/kit';
import { angemeldet, hinweisAktionen } from '#lib/server/aktionen.ts';
import { ActualFehler, actualEingerichtet, ladeKonten, type ActualKonto } from '#lib/server/actual.ts';
import {
	ausgeblendeteHinweise,
	budgetVorlagen,
	holeAusActual,
	uebernehmeTerminplaene,
	warnungenFuer,
	zuordnungAnsicht,
	type Schnappschuss
} from '#lib/server/actualAbgleich.ts';
import type { PersonId } from '#lib/server/db.ts';
import {
	aenderePerson,
	ladeActualStand,
	ladePosten,
	setzeTerminplan,
	speichereZuordnung,
	type ZuordnungEintrag,
	ladePerson
} from '#lib/server/repo.ts';
import type { Actions, PageServerLoad } from './$types';

async function kontenOderFehler(id: PersonId): Promise<{ konten: ActualKonto[]; fehler?: string }> {
	try {
		return { konten: await ladeKonten(id) };
	} catch (e) {
		if (!(e instanceof ActualFehler)) console.error('Actual-Konten nicht geladen', e);
		return { konten: [], fehler: e instanceof ActualFehler ? e.message : 'Die Konten ließen sich nicht laden.' };
	}
}

export const load: PageServerLoad = ({ locals }) => {
	const id = angemeldet(locals);
	const actual = actualEingerichtet(id);
	return {
		actual,
		// Wird nachgeliefert, damit die Seite nicht auf Actual warten muss.
		actualKonten: actual ? kontenOderFehler(id) : null,
		zuordnung: actual ? zuordnungAnsicht(id) : null,
		vorlagen: actual ? budgetVorlagen(id) : null,
		warnungen: warnungenFuer(id),
		ausgeblendet: ausgeblendeteHinweise(id),
		person: ladePerson(id)
	};
};

export const actions: Actions = {
	...hinweisAktionen,

	actualKonto: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const wahl = String((await request.formData()).get('konto') ?? '');
		const [kontoId, ...name] = wahl.split('|');
		const undoId = aenderePerson(
			wer,
			kontoId
				? { actualKontoId: kontoId, actualKontoName: name.join('|'), istQuelle: 'hand', abgleich: null }
				: { actualKontoId: null, actualKontoName: null, istQuelle: 'hand', abgleich: null },
			wer,
			kontoId ? 'Konto in Actual gewählt' : 'Actual-Anbindung ausgeschaltet'
		);
		return { meldung: kontoId ? 'Konto gewählt. Der Kontostand kommt jetzt aus Actual.' : 'Kontostand wieder von Hand.', undoId };
	},

	actualAbruf: async ({ locals }) => {
		const wer = angemeldet(locals);
		try {
			const { geaendert } = await holeAusActual(wer);
			return { meldung: geaendert ? `Abgerufen, ${geaendert} Posten angepasst.` : 'Aus Actual abgerufen.' };
		} catch (e) {
			if (!(e instanceof ActualFehler)) console.error('Actual-Abruf fehlgeschlagen', e);
			return fail(502, {
				bereich: 'actual',
				fehler: { actual: e instanceof ActualFehler ? e.message : 'Der Abruf aus Actual hat nicht geklappt.' }
			});
		}
	},

	gehaltKategorie: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const kategorie = String((await request.formData()).get('kategorie') ?? '') || null;
		const undoId = aenderePerson(wer, { actualGehaltKategorie: kategorie }, wer, 'Gehaltskategorie gewählt');
		return { meldung: kategorie ? 'Gehalt wird jetzt an der Kategorie erkannt.' : 'Gehalt wird am Betrag erkannt.', undoId };
	},

	zuordnung: async ({ request, locals }) => {
		const wer = angemeldet(locals);
		const stand = ladeActualStand<Schnappschuss>(wer);
		if (!stand) return fail(400, { bereich: 'actual', fehler: { actual: 'Bitte zuerst aus Actual abrufen.' } });
		const f = await request.formData();
		const liste: ZuordnungEintrag[] = [];
		const verknuepfe = new Map<string, number | null>();
		for (const t of stand.daten.terminplaene) {
			const wert = String(f.get(`rolle_${t.id}`) ?? '');
			if (!wert) continue;
			if (wert === 'ignorieren') liste.push({ terminplan: t.id, rolle: 'ignorieren', dauerauftrag: null });
			else if (wert.startsWith('dauerauftrag:')) {
				liste.push({ terminplan: t.id, rolle: 'dauerauftrag', dauerauftrag: wert.slice('dauerauftrag:'.length) });
			} else if (wert.startsWith('fixkosten')) {
				liste.push({ terminplan: t.id, rolle: 'fixkosten', dauerauftrag: null });
				const postenId = Number(wert.split(':')[1]);
				if (postenId) verknuepfe.set(t.id, postenId);
			}
		}
		const fixkosten = new Set(liste.filter((z) => z.rolle === 'fixkosten').map((z) => z.terminplan));
		for (const p of ladePosten(wer)) {
			// Nicht mehr als Fixkosten zugeordnet: Posten bleibt, wird aber wieder von Hand gepflegt.
			if (p.actualTerminplan && !fixkosten.has(p.actualTerminplan)) setzeTerminplan(p.id!, null);
		}
		for (const [terminplan, postenId] of verknuepfe) {
			if (postenId && ladePosten(wer).some((p) => p.id === postenId)) setzeTerminplan(postenId, terminplan);
		}
		speichereZuordnung(wer, liste, wer);
		const geaendert = uebernehmeTerminplaene(wer, stand.daten.terminplaene);
		return {
			meldung: geaendert
				? `Zuordnung gespeichert, ${geaendert === 1 ? 'ein Posten' : `${geaendert} Posten`} aus Actual übernommen.`
				: 'Zuordnung gespeichert.'
		};
	}

};
