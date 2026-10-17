<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Barcode from './Barcode.svelte';
	import Icon from './Icon.svelte';
	import { t } from '$lib/i18n.svelte';
	import type { Card } from '$lib/types';

	/**
	 * Full-screen, max-contrast barcode display (REQUIREMENTS §5 "at the checkout"):
	 * white background, barcode scaled to fit, screen wake lock held.
	 * (OS brightness cannot be set from a PWA — white background + wake lock is the
	 * best achievable; a brightness hint toast arrives with polish.)
	 */
	let { card, onclose }: { card: Card; onclose: () => void } = $props();

	let root = $state<HTMLDivElement | undefined>();
	let wakeLock: { release: () => Promise<void> } | null = null;
	let showToast = $state(false);

	async function acquireWakeLock() {
		try {
			if (navigator.wakeLock?.request) wakeLock = await navigator.wakeLock.request('screen');
		} catch {
			/* unsupported/denied — best effort */
		}
	}

	// wake lock is dropped when the tab is hidden; re-acquire when it returns
	function onVisibility() {
		if (document.visibilityState === 'visible') void acquireWakeLock();
	}

	// one-time brightness hint (REQUIREMENTS §5): browsers cannot touch OS brightness,
	// but fullscreen + white rendering + this toast gets users most of the way there.
	function maybeBrightnessToast() {
		try {
			if (localStorage.getItem('loyalfamily.brightnessHintShown')) return;
			localStorage.setItem('loyalfamily.brightnessHintShown', '1');
			showToast = true;
			setTimeout(() => (showToast = false), 5000);
		} catch {
			/* private mode etc. — just show it every time is too noisy; skip */
		}
	}

	async function toggleFullscreen() {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await root?.requestFullscreen();
		} catch {
			/* iOS Safari has no Element.requestFullscreen — white full-viewport overlay is already fullscreen-ish */
		}
	}

	onMount(async () => {
		await acquireWakeLock();
		maybeBrightnessToast();
		document.addEventListener('visibilitychange', onVisibility);
	});

	onDestroy(() => {
		document.removeEventListener('visibilitychange', onVisibility);
		wakeLock?.release().catch(() => {});
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="fullscreen" role="dialog" aria-label={`${t('barcode_for')} ${card.name}`} bind:this={root}>
	<div class="head">
		<h2>{card.comment || card.name}</h2>
		<div class="head-actions">
			<button class="icon-btn" title={t('fullscreen')} aria-label={t('fullscreen')} onclick={toggleFullscreen}>
				<Icon name="fullscreen" />
			</button>
			<button class="icon-btn" aria-label={t('close')} title={t('close')} onclick={onclose}>
				<Icon name="close" />
			</button>
		</div>
	</div>
	<div class="barcode">
		<Barcode value={card.barcode_value} symbology={card.symbology} height={140} />
	</div>
	<p class="value mono">{card.barcode_value}</p>
	<p class="hint">{t('brightness_tip')}</p>
	{#if showToast}
		<div class="toast" role="status">{t('brightness_toast')}</div>
	{/if}
</div>

<style>
	/* Checkout surface stays white in both themes: max contrast for the reader. */
	.fullscreen {
		position: fixed;
		inset: 0;
		background: #ffffff;
		color: #000;
		z-index: var(--z-fullscreen);
		display: flex;
		flex-direction: column;
		padding: calc(1rem + var(--safe-t)) 1rem calc(1rem + var(--safe-b));
	}
	.fullscreen .icon-btn {
		background: #e9ecef;
		color: #000;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.head h2 {
		margin: 0;
		font-size: 1.15rem;
	}
	.head-actions {
		display: flex;
		gap: 0.4rem;
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
	/* human-readable value: the renderer draws bars only, staff can type it if the optical read fails */
	.value {
		font-size: 1rem;
		text-align: center;
		margin: 0 auto 0.5rem;
		max-width: 92%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.hint {
		font-size: 0.95rem;
		color: #555;
		text-align: center;
	}
	.toast {
		position: fixed;
		left: 50%;
		bottom: calc(1.25rem + var(--safe-b));
		transform: translateX(-50%);
		background: #212529;
		color: white;
		border-radius: var(--radius-sm);
		padding: 0.6rem 0.9rem;
		font-size: 0.95rem;
		max-width: 90%;
		z-index: calc(var(--z-fullscreen) + 1);
	}
</style>
