/**
 * Symbole für Fixkosten. Linien-Icons im 24er-Raster, gezeichnet mit `currentColor`,
 * passend zu den übrigen Icons der App.
 */
export const POSTEN_ICONS = {
	haus: { name: 'Wohnen', svg: '<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>' },
	schluessel: { name: 'Stellplatz, Garage', svg: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M14 9l2 2"/>' },
	blitz: { name: 'Strom', svg: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>' },
	flamme: { name: 'Gas, Heizung', svg: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.6-8.3.5 1.9 1.6 3 2.7 3.6C11.6 7 12.6 4.6 14.5 3c.3 3.2 4 5.6 4 11.4 0 3.9-2.6 6.6-6.5 6.6z"/>' },
	tropfen: { name: 'Wasser', svg: '<path d="M12 3.5c3 3.9 6 7.3 6 10.8a6 6 0 0 1-12 0c0-3.5 3-6.9 6-10.8z"/>' },
	wlan: { name: 'Internet', svg: '<path d="M3 9.5a13 13 0 0 1 18 0M6 13a8.3 8.3 0 0 1 12 0M9 16.4a3.8 3.8 0 0 1 6 0"/><circle cx="12" cy="19.5" r=".6" fill="currentColor"/>' },
	handy: { name: 'Handy', svg: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>' },
	fernseher: { name: 'Fernsehen, Rundfunk', svg: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m9 2.5 3 3.5 3-3.5M8 21h8"/>' },
	play: { name: 'Streaming', svg: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5z"/>' },
	musik: { name: 'Musik', svg: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>' },
	spiel: { name: 'Spiele', svg: '<path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 5.4l-.8 4a2.5 2.5 0 0 1-4.4 1L14 15.5h-4l-1.7 1.9a2.5 2.5 0 0 1-4.4-1l-.8-4A4.5 4.5 0 0 1 7.5 7z"/><path d="M8 10v3M6.5 11.5h3"/><circle cx="16" cy="11.5" r=".6" fill="currentColor"/>' },
	wolke: { name: 'Cloud, Speicher', svg: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 5.6 5.6 0 0 1 10.8 1.3A3.9 3.9 0 0 1 17 18.5z"/>' },
	pinsel: { name: 'Software', svg: '<path d="m14 4 6 6-8 8H6v-6z"/><path d="m11 7 6 6"/>' },
	buch: { name: 'Bücher, Lernen', svg: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 21H20"/>' },
	zeitung: { name: 'Zeitung', svg: '<path d="M5 4h12v15a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V4z"/><path d="M17 8h3v11a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h5"/>' },
	auto: { name: 'Auto', svg: '<path d="M4 16v-3.5L6 7.5A2 2 0 0 1 7.9 6h8.2A2 2 0 0 1 18 7.5l2 5V16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 12.5h16M6.5 17v2M17.5 17v2"/><circle cx="7.5" cy="14.5" r=".6" fill="currentColor"/><circle cx="16.5" cy="14.5" r=".6" fill="currentColor"/>' },
	tanken: { name: 'Tanken, Laden', svg: '<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3.5 21h13M5 10h10"/><path d="M15 8h2a2 2 0 0 1 2 2v6.5a1.5 1.5 0 0 0 3 0V9l-3-3"/>' },
	bahn: { name: 'Bus und Bahn', svg: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8.5 21 10 17M15.5 21 14 17"/><circle cx="9" cy="14" r=".6" fill="currentColor"/><circle cx="15" cy="14" r=".6" fill="currentColor"/>' },
	fahrrad: { name: 'Fahrrad', svg: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="m6 16 4-7h5l3 7M10 9 8.5 6H7M15 9l-3 7h-6"/>' },
	flugzeug: { name: 'Reisen', svg: '<path d="M10.5 13.5 4 12l-1 1.5 6 3 3 6 1.5-1-1.5-6.5L17 10l3-3.5a1.4 1.4 0 0 0-2-2L14.5 7.5 6 5.5 4.5 7l6.5 3.5z"/>' },
	schild: { name: 'Versicherung', svg: '<path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6z"/><path d="m9 12 2 2 4-4"/>' },
	schirm: { name: 'Haftpflicht', svg: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6.5a2 2 0 0 1-4 0M12 3v0"/>' },
	herz: { name: 'Gesundheit', svg: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>' },
	pille: { name: 'Apotheke', svg: '<rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m9 9 6 6"/>' },
	hantel: { name: 'Sport', svg: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>' },
	schere: { name: 'Friseur, Pflege', svg: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5 20 18M8 15.5 20 6"/>' },
	einkauf: { name: 'Einkauf', svg: '<path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>' },
	paket: { name: 'Versand, Abo-Box', svg: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9M8 5.3l8 4.5"/>' },
	kaffee: { name: 'Kaffee', svg: '<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M12 3.5v2"/>' },
	besteck: { name: 'Essen', svg: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 1-3.5 3.5-3.5 7v3H17"/>' },
	kind: { name: 'Kinder', svg: '<circle cx="12" cy="7" r="3"/><path d="M8 21v-4l-2-3.5L8 11h8l2 2.5-2 3.5v4M12 17v4"/>' },
	pfote: { name: 'Haustier', svg: '<circle cx="7" cy="10" r="1.8"/><circle cx="10.5" cy="6" r="1.8"/><circle cx="14.5" cy="6" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M8.5 17.5c0-2.8 1.8-5 4-5s4 2.2 4 5a2.2 2.2 0 0 1-2.8 2.1 4.6 4.6 0 0 0-2.4 0 2.2 2.2 0 0 1-2.8-2.1z"/>' },
	schule: { name: 'Bildung', svg: '<path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z"/><path d="M6.5 11v5c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2v-5M21.5 9v5"/>' },
	bank: { name: 'Kredit, Bank', svg: '<path d="M3 9.5 12 4l9 5.5M4.5 20h15M6 10.5v7M10 10.5v7M14 10.5v7M18 10.5v7"/>' },
	karte: { name: 'Karte, Gebühren', svg: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>' },
	sparschwein: { name: 'Sparen', svg: '<path d="M18.5 11.5c0-3.3-3.1-5.5-7-5.5S4.5 8.2 4.5 11.5c0 2 1.1 3.6 2.8 4.6V19h2.5l.6-1.6a9.4 9.4 0 0 0 3.2 0l.6 1.6h2.5v-2.9c.8-.5 1.4-1.1 1.9-1.8h1.4v-3h-1.6z"/><path d="M10 6.3V5.5a1.5 1.5 0 0 1 3 0v.6"/><circle cx="15.5" cy="10.5" r=".6" fill="currentColor"/>' },
	muenzen: { name: 'Beitrag', svg: '<ellipse cx="9" cy="7" rx="5" ry="2.5"/><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7"/><path d="M10 15.4V17c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4c0-1.4-2.2-2.5-5-2.5"/>' },
	geschenk: { name: 'Geschenke, Spenden', svg: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9c2 0 5.5-.5 5.5-1.5S13.5 5.5 12 9z"/>' },
	werkzeug: { name: 'Reparatur, Wartung', svg: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2z"/><path d="M14.5 6.5 17 4l3 3-2.5 2.5"/>' },
	kalender: { name: 'Mitgliedschaft', svg: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>' },
	stern: { name: 'Sonstiges', svg: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>' }
} as const satisfies Record<string, { name: string; svg: string }>;

export type PostenIcon = keyof typeof POSTEN_ICONS;

export const istPostenIcon = (s: unknown): s is PostenIcon => typeof s === 'string' && Object.hasOwn(POSTEN_ICONS, s);

/** Stichworte im Namen → Symbol. Die erste passende Regel gewinnt. */
const REGELN: [RegExp, PostenIcon][] = [
	[/miete|wohn|nebenkosten|hausgeld|grundsteuer/, 'haus'],
	[/garage|stellplatz|parkplatz/, 'schluessel'],
	[/strom|energie/, 'blitz'],
	[/gas|heiz|fernwärme/, 'flamme'],
	[/wasser|abwasser/, 'tropfen'],
	[/internet|dsl|glasfaser|telekom|vodafone|1&1|o2|wlan/, 'wlan'],
	[/handy|mobil|telefon|\bsim\b/, 'handy'],
	[/rundfunk|\bgez\b|\btv\b|fernseh|sky|waipu|zattoo/, 'fernseher'],
	[/netflix|disney|prime video|dazn|youtube|stream|joyn|paramount|wow|apple tv/, 'play'],
	[/spotify|musik|music|deezer|tidal|audible/, 'musik'],
	[/playstation|xbox|nintendo|game|steam/, 'spiel'],
	[/icloud|cloud|dropbox|onedrive|speicher|google one/, 'wolke'],
	[/adobe|office|microsoft|software|lizenz|chatgpt|claude|notion|1password|vpn/, 'pinsel'],
	[/zeitung|spiegel|zeit|abo.*magazin|magazin|faz|süddeutsche/, 'zeitung'],
	[/kindle|buch|bücher|blinkist|kurs|udemy/, 'buch'],
	[/kfz|auto|leasing|mazda|suzuki|tesla|\bvw\b|bmw|audi|skoda|opel|ford|toyota|hyundai|kia|renault|seat|mercedes|kfz-steuer|tüv|werkstatt.*auto/, 'auto'],
	[/tank|sprit|laden|wallbox|ladestrom/, 'tanken'],
	[/deutschlandticket|bahn|bvg|mvv|hvv|öpnv|ticket|\bbus\b/, 'bahn'],
	[/fahrrad|bike|jobrad/, 'fahrrad'],
	[/urlaub|reise|flug/, 'flugzeug'],
	[/haftpflicht|rechtsschutz/, 'schirm'],
	[/versicherung|hausrat|berufsunfähig|bu\b|risikoleben|allianz|huk|ergo/, 'schild'],
	[/kranken|zahn|arzt|brille|gesundheit/, 'herz'],
	[/apotheke|medikament|vitamin/, 'pille'],
	[/fitness|gym|clever ?fit|mcfit|urban sports|sport|verein/, 'hantel'],
	[/friseur|kosmetik|pflege/, 'schere'],
	[/lebensmittel|einkauf|rewe|edeka|lidl|aldi|drogerie/, 'einkauf'],
	[/amazon|prime|paket|box/, 'paket'],
	[/kaffee|coffee/, 'kaffee'],
	[/essen|lieferando|hellofresh|kantine/, 'besteck'],
	[/kita|kind|schule.*kind|taschengeld|baby/, 'kind'],
	[/hund|katze|tier/, 'pfote'],
	[/schule|studium|uni|weiterbildung|bildung/, 'schule'],
	[/kreditkarte|konto|gebühr|karte/, 'karte'],
	[/kredit|darlehen|tilgung|rate|finanzierung|bank/, 'bank'],
	[/spar|etf|depot|rücklage|bauspar|altersvorsorge|rente/, 'sparschwein'],
	[/beitrag|mitglied|gewerkschaft|adac/, 'muenzen'],
	[/spende|patenschaft|geschenk|geburtstag/, 'geschenk'],
	[/reparatur|wartung|handwerk/, 'werkzeug']
];

export function schlageIconVor(name: string): PostenIcon | null {
	const n = name.toLocaleLowerCase('de-DE');
	return REGELN.find(([muster]) => muster.test(n))?.[1] ?? null;
}

/** Gewähltes Symbol, sonst ein Vorschlag aus dem Namen, sonst keins (dann zeigt die App den Anfangsbuchstaben). */
export const iconFuer = (name: string, gewaehlt?: string | null): PostenIcon | null =>
	istPostenIcon(gewaehlt) ? gewaehlt : schlageIconVor(name);
