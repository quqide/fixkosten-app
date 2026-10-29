<script lang="ts">
	import type { Verlaufspunkt } from '#lib/rechnung/verlauf.ts';
	import { datumLang, eurGanz, monatsKuerzel } from '#lib/format.ts';
	import { parseDatum } from '#lib/rechnung/datum.ts';

	let { punkte }: { punkte: Verlaufspunkt[] } = $props();

	const W = 640, H = 210, L = 56, R = 14, T = 30, B = 28;

	const tagIndex = (iso: string) => {
		const a = parseDatum(punkte[0].datum), b = parseDatum(iso);
		return Math.round((Date.UTC(b.j, b.m - 1, b.t) - Date.UTC(a.j, a.m - 1, a.t)) / 864e5);
	};

	const grafik = $derived.by(() => {
		const tage = tagIndex(punkte[punkte.length - 1].datum) || 1;
		const max = Math.max(...punkte.map((p) => p.sollCent), 1);
		const oben = Math.ceil(max / 50000) * 50000;
		const x = (i: number) => L + (i / tage) * (W - L - R);
		const y = (v: number) => T + (1 - Math.max(0, v) / oben) * (H - T - B);
		const linie = punkte.map((p, k) => `${k ? 'L' : 'M'}${x(tagIndex(p.datum)).toFixed(1)},${y(p.sollCent).toFixed(1)}`).join('');
		const spitze = punkte.reduce((a, b) => (b.sollCent > a.sollCent ? b : a));
		const raster = [0, 1, 2, 3, 4].map((k) => (oben / 4) * k);
		const start = parseDatum(punkte[0].datum);
		const monate = [1, 3, 5, 7, 9, 11].map((k) => {
			const z = start.j * 12 + start.m - 1 + k;
			const j = Math.floor(z / 12), m = (z % 12) + 1;
			return { x: x(tagIndex(`${j}-${String(m).padStart(2, '0')}-01`)), text: monatsKuerzel(m) };
		});
		return { x, y, linie, flaeche: `${linie}L${x(tage)},${y(0)}L${x(0)},${y(0)}Z`, spitze, raster, monate };
	});
</script>

<svg class="chart" viewBox="0 0 {W} {H}" role="img"
	aria-label="Benötigte Rücklage in den nächsten 12 Monaten, am höchsten mit {eurGanz(grafik.spitze.sollCent)} am {datumLang(grafik.spitze.datum)}">
	{#each grafik.raster as v (v)}
		<line x1={L} x2={W - R} y1={grafik.y(v)} y2={grafik.y(v)} stroke="var(--separator)" stroke-dasharray={v ? '3 4' : ''} />
		<text x={L - 8} y={grafik.y(v) + 4} text-anchor="end">{eurGanz(v)}</text>
	{/each}
	{#each grafik.monate as m (m.text)}
		<text x={m.x} y={H - 8} text-anchor="middle">{m.text}</text>
	{/each}
	<path d={grafik.flaeche} fill="color-mix(in srgb, var(--tint) 15%, transparent)" />
	<path d={grafik.linie} fill="none" stroke="var(--tint)" stroke-width="2.2" stroke-linejoin="round" />
	<circle cx={grafik.x(0)} cy={grafik.y(punkte[0].sollCent)} r="5" fill="var(--surface)" stroke="var(--tint)" stroke-width="2.5" />
	<text x={grafik.x(0) + 2} y={grafik.y(punkte[0].sollCent) + 22}>heute</text>
	<circle cx={grafik.x(tagIndex(grafik.spitze.datum))} cy={grafik.y(grafik.spitze.sollCent)} r="5" fill="var(--tint)" stroke="var(--surface)" stroke-width="2" />
	<text class="peak" x={Math.min(grafik.x(tagIndex(grafik.spitze.datum)), W - R)} y={grafik.y(grafik.spitze.sollCent) - 11} text-anchor="end">{eurGanz(grafik.spitze.sollCent)}</text>
</svg>

<style>
	.chart { width: 100%; height: auto; display: block; }
	text { fill: var(--secondary); font: 12px var(--font); }
	.peak { fill: var(--label); font-weight: 700; }
</style>
