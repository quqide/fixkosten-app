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
	}
};

export const STANDARD_THEME = 'salbei';

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
