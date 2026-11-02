/** Die vier Bereiche der Tab-Leiste, oben am Rechner und unten am Handy. */
export const BEREICHE = [
	{ pfad: '/', name: 'Übersicht', icon: 'uebersicht' },
	{ pfad: '/fixkosten', name: 'Fixkosten', icon: 'fixkosten' },
	{ pfad: '/plan', name: 'Mein Plan', icon: 'plan' },
	{ pfad: '/gemeinsam', name: 'Gemeinsam', icon: 'gemeinsam' }
] as const;

/** Unterseiten ohne eigenen Tab, die zu einem Bereich gehören. */
const UNTERSEITEN: Record<string, string> = { '/rechner': '/plan' };

/** Pfad des Tabs, der für diese Seite markiert ist, oder null (z. B. Einstellungen). */
export function aktiverBereich(pfad: string): string | null {
	const p = pfad.length > 1 ? pfad.replace(/\/+$/, '') : pfad;
	if (UNTERSEITEN[p]) return UNTERSEITEN[p];
	return BEREICHE.find((b) => (b.pfad === '/' ? p === '/' : p === b.pfad || p.startsWith(b.pfad + '/')))?.pfad ?? null;
}
