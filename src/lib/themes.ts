export interface Farben {
	tint: string;
	tintSoft: string;
	bg: string;
	surface: string;
	fill: string;
	separator: string;
}

export interface Theme {
	name: string;
	hell: Farben;
	dunkel: Farben;
}

export const THEMES: Record<string, Theme> = {
	salbei: {
		name: 'Salbei',
		hell: { tint: '#217a5f', tintSoft: '#dff1e8', bg: '#f3f6f4', surface: '#ffffff', fill: '#e8eeea', separator: '#e3e9e5' },
		dunkel: { tint: '#5fd0a6', tintSoft: '#183128', bg: '#101513', surface: '#1a211e', fill: '#25302b', separator: '#2c3833' }
	},
	ozean: {
		name: 'Ozean',
		hell: { tint: '#1f68ad', tintSoft: '#e1edf9', bg: '#f2f5f9', surface: '#ffffff', fill: '#e6ecf3', separator: '#e1e7ef' },
		dunkel: { tint: '#7cb8f2', tintSoft: '#172a3d', bg: '#0f1318', surface: '#181e26', fill: '#232b35', separator: '#2b3440' }
	},
	pflaume: {
		name: 'Pflaume',
		hell: { tint: '#7445ad', tintSoft: '#efe7f8', bg: '#f6f3f9', surface: '#ffffff', fill: '#ece6f2', separator: '#e8e1ef' },
		dunkel: { tint: '#c3a2f0', tintSoft: '#2a2140', bg: '#131019', surface: '#1d1824', fill: '#2a2333', separator: '#342c3f' }
	},
	koralle: {
		name: 'Koralle',
		hell: { tint: '#b4482a', tintSoft: '#fbe7df', bg: '#faf5f2', surface: '#ffffff', fill: '#f1e8e3', separator: '#ece2dc' },
		dunkel: { tint: '#ff9a78', tintSoft: '#3a221a', bg: '#161110', surface: '#211a18', fill: '#2f2522', separator: '#3a2e2a' }
	},
	graphit: {
		name: 'Graphit',
		hell: { tint: '#37424d', tintSoft: '#e7eaed', bg: '#f4f5f6', surface: '#ffffff', fill: '#e9ebed', separator: '#e2e5e8' },
		dunkel: { tint: '#c9d1d9', tintSoft: '#272c31', bg: '#111315', surface: '#1b1e21', fill: '#26292d', separator: '#30353a' }
	},
	lagune: {
		name: 'Lagune',
		hell: { tint: '#0b6f78', tintSoft: '#dcf1f2', bg: '#f1f6f6', surface: '#ffffff', fill: '#e3eeee', separator: '#dfebec' },
		dunkel: { tint: '#5fd3dc', tintSoft: '#16302f', bg: '#0e1414', surface: '#172124', fill: '#223134', separator: '#293a3d' }
	},
	bernstein: {
		name: 'Bernstein',
		hell: { tint: '#94580a', tintSoft: '#f8ecd8', bg: '#f8f5ef', surface: '#ffffff', fill: '#f2ece1', separator: '#f0e8dd' },
		dunkel: { tint: '#f2b45c', tintSoft: '#3a2a14', bg: '#14110c', surface: '#221c14', fill: '#342b1f', separator: '#3d3326' }
	},
	himbeere: {
		name: 'Himbeere',
		hell: { tint: '#ad2a5c', tintSoft: '#f9e2eb', bg: '#faf3f6', surface: '#ffffff', fill: '#f5e7ed', separator: '#f4e3ea' },
		dunkel: { tint: '#ff8fb8', tintSoft: '#3a1a28', bg: '#161013', surface: '#241820', fill: '#36262f', separator: '#402d37' }
	},
	indigo: {
		name: 'Indigo',
		hell: { tint: '#4248b8', tintSoft: '#e6e7fa', bg: '#f4f4fb', surface: '#ffffff', fill: '#e9eaf7', separator: '#e6e6f6' },
		dunkel: { tint: '#a3a9ff', tintSoft: '#23264a', bg: '#111219', surface: '#1b1c2a', fill: '#292b3c', separator: '#313345' }
	},
	olive: {
		name: 'Olive',
		hell: { tint: '#5b6a1c', tintSoft: '#edf1dc', bg: '#f6f7f1', surface: '#ffffff', fill: '#edefe4', separator: '#eaece0' },
		dunkel: { tint: '#c3d47a', tintSoft: '#2a3016', bg: '#12140d', surface: '#1d2016', fill: '#2d3023', separator: '#35392a' }
	},
	nachtblau: {
		name: 'Nachtblau',
		hell: { tint: '#1e3a6e', tintSoft: '#e2e8f4', bg: '#f3f5f9', surface: '#ffffff', fill: '#e6eaf1', separator: '#e2e6ee' },
		dunkel: { tint: '#8fb3ff', tintSoft: '#1c2740', bg: '#0d1118', surface: '#151a24', fill: '#232936', separator: '#2b3140' }
	}
};

export const STANDARD_THEME = 'salbei';

/** Ein gespeichertes Thema, das es nicht (mehr) gibt, fällt auf das Standardthema zurück. */
export const gueltigesThema = (id: string | null | undefined): string => (id && Object.hasOwn(THEMES, id) ? id : STANDARD_THEME);

const variablen = (f: Farben) =>
	`--tint:${f.tint};--tint-soft:${f.tintSoft};--bg:${f.bg};--surface:${f.surface};--fill:${f.fill};--separator:${f.separator};`;

/** CSS für alle Themes: hell als Standard, dunkel per Systemeinstellung oder fest gewählt. */
export const themeCss = Object.entries(THEMES)
	.map(
		([id, t]) =>
			`:root[data-palette="${id}"]{${variablen(t.hell)}}` +
			`@media (prefers-color-scheme: dark){:root[data-palette="${id}"]:not([data-theme="light"]){${variablen(t.dunkel)}}}` +
			`:root[data-palette="${id}"][data-theme="dark"]{${variablen(t.dunkel)}}`
	)
	.join('\n');
