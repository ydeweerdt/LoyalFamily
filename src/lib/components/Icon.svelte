<script lang="ts">
	/** Minimal inline SVG icons (Catima-style). */
	let { name, size = 20 }: { name: 'back' | 'pencil' | 'trash' | 'scan'; size?: number } = $props();

	const paths: Record<string, string> = {
		back: 'M20 11H7.8l5.1-5.1L12 5l-7 7 7 7 1.1-1.1L7.8 13H20v-2z',
		pencil:
			'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
		trash: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
		scan: 'M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4zM9 11h6v2H9v-2z'
	};
</script>

<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
	<path fill="currentColor" d={paths[name]} />
</svg>
