<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { BrowserMultiFormatReader, DecodeHintType, type Result } from '@zxing/library';
	import { formatName, mapFormat, orderedFormats } from '$lib/domain/scanner';
	import Icon from '$lib/components/Icon.svelte';
	import { t } from '$lib/i18n.svelte';

	/**
	 * Camera scanner overlay.
	 * Native BarcodeDetector when available (fast, hardware-accelerated),
	 * ZXing (pure JS, bundled) as fallback. Brand symbology hint prioritizes
	 * the decoder. Emits (value, symbology) on first confident read.
	 */
	let {
		symbologyHint,
		ondetect,
		onmanual,
		onclose
	}: {
		symbologyHint?: string;
		ondetect: (value: string, symbology: string) => void;
		onmanual: () => void;
		onclose: () => void;
	} = $props();

	let videoEl = $state<HTMLVideoElement | undefined>();
	let status = $state(t('requesting_camera'));
	let stream: MediaStream | undefined;
	let track: MediaStreamTrack | undefined;
	let canTorch = $state(false);
	let torchOn = $state(false);
	let reader: BrowserMultiFormatReader | undefined;
	let timer: ReturnType<typeof setInterval> | undefined;
	let done = false;
	let last = '';

	function finish(value: string, symbology: string) {
		if (done) return;
		done = true;
		stop();
		navigator.vibrate?.(60); // haptic confirmation: the read landed, the camera can go back in a pocket
		ondetect(value, symbology);
	}

	async function toggleTorch() {
		torchOn = !torchOn;
		try {
			await track?.applyConstraints({ advanced: [{ torch: torchOn } as MediaTrackConstraintSet] });
		} catch {
			torchOn = false;
		}
	}

	function stop() {
		if (timer) clearInterval(timer);
		reader?.reset();
		stream?.getTracks().forEach((t) => t.stop());
	}

	onDestroy(stop);

	onMount(async () => {
		try {
			stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
		} catch {
			status = t('camera_unavailable');
			return;
		}
		if (done || !videoEl) return;
		videoEl.srcObject = stream;
		await videoEl.play().catch(() => {});
		track = stream.getVideoTracks()[0];
		canTorch = Boolean((track?.getCapabilities?.() as Record<string, unknown> | undefined)?.torch);

		const formats = orderedFormats(symbologyHint);

		// A browser that does not implement every format name may reject the whole list;
		// the ZXing fallback below then takes over.
		let detector: { detect: (s: HTMLVideoElement) => Promise<{ rawValue: string; format: string }[]> } | undefined;
		try {
			// @ts-expect-error BarcodeDetector is not in the standard TS DOM lib yet
			detector = typeof BarcodeDetector === 'function' ? new BarcodeDetector({ formats: formats.map((f) => formatName(f).toLowerCase()) }) : undefined;
		} catch {
			detector = undefined;
		}

		if (detector) {
			status = t('scanning');
			timer = setInterval(async () => {
				if (done || !videoEl) return;
				try {
					const codes = await detector.detect(videoEl);
					for (const c of codes) {
						const sym = mapFormat(c.format);
						if (sym && c.rawValue) {
							if (c.rawValue !== last) finish(c.rawValue, sym);
							return;
						}
						last = '';
					}
				} catch {
					/* frame glitch — keep scanning */
				}
			}, 300);
		} else {
			status = t('scanning_compat');
			const hints = new Map();
			hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
			hints.set(DecodeHintType.TRY_HARDER, true);
			reader = new BrowserMultiFormatReader(hints, 400);
			reader.decodeFromVideoElementContinuously(videoEl, (result?: Result) => {
				if (done || !result) return;
				const sym = mapFormat(formatName(result.getBarcodeFormat()));
				const text = result.getText();
				if (sym && text && text !== last) finish(text, sym);
			});
		}
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="scanner" role="dialog" aria-label={t('scan_barcode')}>
	<button class="back" aria-label={t('back')} title={t('back')} onclick={onclose}>
		<Icon name="back" size={24} />
	</button>
	<video bind:this={videoEl} playsinline muted autoplay></video>
	<div class="frame" aria-hidden="true"><div class="scanline"></div></div>
	<p class="status">{status}</p>
	<div class="controls">
		{#if canTorch}
			<button class="btn {torchOn ? 'on' : ''}" aria-pressed={torchOn} onclick={toggleTorch}><Icon name="torch" /> {t('torch')}</button>
		{/if}
		<button class="btn" onclick={onmanual}>{t('manual')}</button>
	</div>
</div>

<style>
	.scanner {
		position: fixed;
		inset: 0;
		background: #000;
		color: #fff;
		z-index: var(--z-scanner);
		display: flex;
		flex-direction: column;
	}
	video {
		flex: 1;
		width: 100%;
		object-fit: cover;
	}
	.back {
		position: absolute;
		top: calc(0.75rem + var(--safe-t));
		left: 0.75rem;
		z-index: calc(var(--z-scanner) + 1);
		background: rgba(0, 0, 0, 0.45);
		color: white;
		border: none;
		border-radius: 50%;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.frame {
		position: absolute;
		top: 50%;
		left: 50%;
		width: min(80vw, 420px);
		height: min(40vh, 220px);
		transform: translate(-50%, -50%);
		border: 2px solid rgba(255, 255, 255, 0.85);
		border-radius: var(--radius);
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
		pointer-events: none;
	}
	.scanline {
		position: absolute;
		left: 6%;
		right: 6%;
		height: 2px;
		background: rgba(255, 255, 255, 0.9);
		animation: scan 1.8s ease-in-out infinite;
	}
	@keyframes scan {
		from {
			top: 6%;
		}
		to {
			top: 92%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.scanline {
			animation: none;
			top: 50%;
		}
	}
	.status {
		color: #fff;
		text-align: center;
		font-size: 0.95rem;
		padding: 0.5rem;
	}
	.controls {
		padding: 0.75rem 0.75rem calc(0.75rem + var(--safe-b));
		display: flex;
		justify-content: center;
		gap: 0.5rem;
	}
	.controls .btn.on {
		background: var(--brand);
		color: var(--brand-ink);
	}
</style>
