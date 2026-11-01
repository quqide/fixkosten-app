import { betragFeld } from '#lib/format.ts';
import { berechnePersonAnsicht } from '#lib/rechnung/ansicht.ts';
import { heute } from '#lib/rechnung/datum.ts';
import { istLeer, leseAenderung, mitAenderung, vergleicheAnsichten } from '#lib/rechnung/rechner.ts';
import { angemeldet } from '#lib/server/aktionen.ts';
import { ladePersonEingaben } from '#lib/server/ansicht.ts';
import type { PageServerLoad } from './$types';

// Der Rechner liest nur: keine Form-Actions, keine Speicherfunktionen.
export const load: PageServerLoad = ({ locals, url }) => {
	const id = angemeldet(locals);
	const stichtag = heute();
	const eingaben = ladePersonEingaben(id);
	const { aenderung, zeilen, fehler } = leseAenderung(url.searchParams);
	const vorher = berechnePersonAnsicht(eingaben, stichtag);
	const nachher = berechnePersonAnsicht(mitAenderung(eingaben, aenderung), stichtag);
	const [pa, pb] = eingaben.gemeinschaft.personen;
	const [ich, andere] = id === 'a' ? [pa, pb] : [pb, pa];
	const param = (name: string, wert: number) => url.searchParams.get(name) ?? betragFeld(wert);
	const ohne = new Set(url.searchParams.getAll('ohne'));
	const posten = (liste: typeof eingaben.posten, gemeinsam: boolean) =>
		liste.map((p) => ({ id: p.id!, name: p.name, betragCent: p.betragCent, intervallMonate: p.intervallMonate, gemeinsam, ohne: ohne.has(String(p.id)) }));

	return {
		namen: { ich: ich.name, andere: andere.name },
		// Was im Formular steht: der Parameter, sonst der heutige Wert.
		felder: {
			netto: param('netto', ich.nettoCent),
			netto2: param('netto2', andere.nettoCent),
			positionen: eingaben.gemeinschaft.konto.positionen
				.filter((p) => p.art === 'fest' && p.id != null)
				.map((p) => ({ id: p.id!, name: p.name, wert: param(`pos_${p.id}`, p.betragCent) })),
			posten: [...posten(eingaben.posten, false), ...posten(eingaben.gemeinschaft.posten, true)],
			zeilen
		},
		fehler,
		geaendert: !istLeer(aenderung),
		vergleich: vergleicheAnsichten(vorher, nachher, id, { ich: ich.name, andere: andere.name }),
		warnungen: { heute: vorher.aufstellung.warnungen, mit: nachher.aufstellung.warnungen }
	};
};
