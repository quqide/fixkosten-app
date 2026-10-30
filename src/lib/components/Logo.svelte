<script lang="ts">
	let { size = 28 }: { size?: number } = $props();
</script>

<!-- Wiederkehrender Pfeil um ein Euro-Zeichen; Farbe folgt dem Farbthema. -->
<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
	<rect width="32" height="32" rx="8" fill="var(--tint)" />
	<g fill="none" stroke="var(--surface)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
		<path d="M24.46 19.08A9 9 0 1 1 22.36 9.64" />
		<path d="M21.97 5.16 22.36 9.64 17.88 9.25" />
		<path d="M19.2 12.9A4 4 0 1 0 19.2 19.1M11.8 15.1h5.4M11.8 17.1h5.4" stroke-width="1.9" />
	</g>
</svg>
