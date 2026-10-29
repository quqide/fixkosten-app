/** Kalendertag ohne Uhrzeit und Zeitzone. Monat 1–12. */
export interface Tag {
	j: number;
	m: number;
	t: number;
}

/** Datum als ISO-Text `JJJJ-MM-TT`, so wird es gespeichert und übergeben. */
export type IsoDatum = string;

export function parseDatum(iso: IsoDatum): Tag {
	const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	if (!treffer) throw new Error(`Ungültiges Datum: ${iso}`);
	const tag = { j: Number(treffer[1]), m: Number(treffer[2]), t: Number(treffer[3]) };
	if (tag.m < 1 || tag.m > 12 || tag.t < 1 || tag.t > tageImMonat(tag.j, tag.m)) {
		throw new Error(`Ungültiges Datum: ${iso}`);
	}
	return tag;
}

export function formatDatum(tag: Tag): IsoDatum {
	const zweistellig = (n: number) => String(n).padStart(2, '0');
	return `${tag.j}-${zweistellig(tag.m)}-${zweistellig(tag.t)}`;
}

export function tageImMonat(j: number, m: number): number {
	return new Date(Date.UTC(j, m, 0)).getUTCDate();
}

/** Tag im Monat, auf das Monatsende begrenzt (31. im Februar → 28./29.). */
export function tagImMonat(j: number, m: number, t: number): Tag {
	return { j, m, t: Math.min(t, tageImMonat(j, m)) };
}

/** Fortlaufende Monatsnummer, damit sich Monate einfach subtrahieren lassen. */
export function monatsNummer(tag: Tag): number {
	return tag.j * 12 + (tag.m - 1);
}

/** Wie EDATE: verschiebt um ganze Monate, der Tag wird aufs Monatsende begrenzt. */
export function plusMonate(tag: Tag, monate: number): Tag {
	const ziel = monatsNummer(tag) + monate;
	return tagImMonat(Math.floor(ziel / 12), (ziel % 12 + 12) % 12 + 1, tag.t);
}

export function vergleiche(a: Tag, b: Tag): number {
	return a.j - b.j || a.m - b.m || a.t - b.t;
}

export function heute(): IsoDatum {
	const jetzt = new Date();
	return formatDatum({ j: jetzt.getFullYear(), m: jetzt.getMonth() + 1, t: jetzt.getDate() });
}
