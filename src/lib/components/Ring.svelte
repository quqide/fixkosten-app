<script lang="ts">
	/** Kreis, der zeigt, wie viel vom Soll gedeckt ist. */
	let { anteil, farbe }: { anteil: number; farbe: string } = $props();
	const r = 44;
	const umfang = 2 * Math.PI * r;
	const gefuellt = $derived(umfang * Math.max(0, Math.min(1, anteil)));
</script>

<div class="ring">
	<svg viewBox="0 0 100 100" aria-hidden="true">
		<circle cx="50" cy="50" {r} fill="none" stroke="var(--fill)" stroke-width="10" />
		<circle cx="50" cy="50" {r} fill="none" stroke={farbe} stroke-width="10" stroke-linecap="round"
			stroke-dasharray="{gefuellt.toFixed(1)} {umfang.toFixed(1)}" />
	</svg>
	<div class="pct">{Math.round(Math.min(anteil, 9.99) * 100)} %<small>gedeckt</small></div>
</div>

<style>
	.ring { width: 104px; height: 104px; position: relative; flex: none; }
	svg { width: 100%; height: 100%; transform: rotate(-90deg); }
	.pct { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; text-align: center; font-weight: 800; font-size: 19px; line-height: 1; }
	small { display: block; font-size: 11px; font-weight: 600; color: var(--secondary); margin-top: 3px; }
	@media (max-width: 640px) { .ring { width: 88px; height: 88px; } }
</style>
