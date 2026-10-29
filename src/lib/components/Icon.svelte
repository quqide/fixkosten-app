<script lang="ts">
	let { name, size = 20 }: { name: string; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
	{#if name === 'uebersicht'}
		<path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5" />
	{:else if name === 'fixkosten'}
		<rect x="4" y="3.5" width="16" height="17" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" />
	{:else if name === 'gemeinsam'}
		<circle cx="9" cy="8.5" r="3.2" /><circle cx="16.5" cy="9.5" r="2.6" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15 14.2c2.6-.3 4.8 1.2 5.5 4.3" />
	{:else if name === 'einstellungen'}
		<path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2.2" /><circle cx="8" cy="17" r="2.2" />
	{:else if name === 'plus'}
		<path d="M12 5v14M5 12h14" stroke-width="2.4" />
	{:else if name === 'schliessen'}
		<path d="M6 6l12 12M18 6 6 18" />
	{:else if name === 'pfeil'}
		<path d="M9 5l7 7-7 7" stroke-width="2.4" />
	{:else if name === 'haken'}
		<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.4" />
	{/if}
</svg>
