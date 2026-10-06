<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Barcode from './Barcode.svelte';
	import type { Card } from '$lib/types';

	/**
	 * Full-screen, max-contrast barcode display (REQUIREMENTS §5 "at the checkout"):
	 * white background, barcode scaled to fit, screen wake lock held.
	 * (OS brightness cannot be set from a PWA — white background + wake lock is the
	 * best achievable; a brightness hint toast arrives with polish.)
	 */
	let { card, onclose }: { card: Card; onclose: () => void } = $props();

	let wakeLock: { release: () => Promise<void> } | null = null;

	onMount(async () => {
		try {
			if (navigator.wakeLock?.request) wakeLock = await navigator.wakeLock.request('screen');
		} catch {
			/* best effort */
		}
	});

	onDestroy(() => wakeLock?.release().catch(() => {}));
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="fullscreen" role="dialog" aria-label="Barcode for {card.name}">
	<div class="head">
		<h2>{card.comment || card.name}</h2>
		<button class="close" onclick={onclose}>✕</button>
	</div>
	<div class="barcode">
		<Barcode value={card.barcode_value} symbology={card.symbology} height={140} />
	</div>
	<p class="hint">Tip: raise your phone brightness and tap fullscreen on your browser for best scanner readability.</p>
</div>

<style>
	.fullscreen {
		position: fixed;
		inset: 0;
		background: #ffffff;
		color: #000;
		z-index: 100;
		display: flex;
		flex-direction: column;
		padding: 1rem;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.head h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.close {
		background: #e9ecef;
		font-size: 1rem;
	}
	.barcode {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.barcode :global(svg) {
		max-width: 100%;
		max-height: 100%;
		width: auto;
	}
	.hint {
		font-size: 0.75rem;
		color: #666;
		text-align: center;
	}
</style>
