<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { BrowserMultiFormatReader, DecodeHintType, type Result } from '@zxing/library';
	import { formatName, mapFormat, orderedFormats } from '$lib/domain/scanner';

	/**
	 * Camera scanner overlay.
	 * Native BarcodeDetector when available (fast, hardware-accelerated),
	 * ZXing (pure JS, bundled) as fallback. Brand symbology hint prioritizes
	 * the decoder. Emits (value, symbology) on first confident read.
	 */
	let {
		symbologyHint,
		ondetect,
		onclose
	}: {
		symbologyHint?: string;
		ondetect: (value: string, symbology: string) => void;
		onclose: () => void;
	} = $props();

	let videoEl = $state<HTMLVideoElement | undefined>();
	let status = $state('Requesting camera…');
	let stream: MediaStream | undefined;
	let reader: BrowserMultiFormatReader | undefined;
	let timer: ReturnType<typeof setInterval> | undefined;
	let done = false;
	let last = '';

	function finish(value: string, symbology: string) {
		if (done) return;
		done = true;
		stop();
		ondetect(value, symbology);
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
			status = 'Camera unavailable (permission or insecure context) — enter the value manually.';
			return;
		}
		if (done || !videoEl) return;
		videoEl.srcObject = stream;
		await videoEl.play().catch(() => {});

		const formats = orderedFormats(symbologyHint);

		// @ts-expect-error BarcodeDetector is not in the standard TS DOM lib yet
		if (typeof BarcodeDetector === 'function') {
			status = 'Scanning…';
			// @ts-expect-error see above
			const detector = new BarcodeDetector({ formats: formats.map((f) => formatName(f).toLowerCase()) });
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
			status = 'Scanning (compatibility mode)…';
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

<div class="scanner" role="dialog" aria-label="Scan barcode">
	<video bind:this={videoEl} playsinline muted autoplay></video>
	<div class="frame" aria-hidden="true"></div>
	<p class="status">{status}</p>
	<div class="controls">
		<button class="secondary" onclick={onclose}>Cancel / enter manually</button>
	</div>
</div>

<style>
	.scanner {
		position: fixed;
		inset: 0;
		background: #000;
		z-index: 200;
		display: flex;
		flex-direction: column;
	}
	video {
		flex: 1;
		width: 100%;
		object-fit: cover;
	}
	.frame {
		position: absolute;
		top: 50%;
		left: 50%;
		width: min(80vw, 420px);
		height: min(40vh, 220px);
		transform: translate(-50%, -50%);
		border: 2px solid rgba(255, 255, 255, 0.85);
		border-radius: 10px;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
		pointer-events: none;
	}
	.status {
		color: #fff;
		text-align: center;
		font-size: 0.85rem;
		padding: 0.5rem;
	}
	.controls {
		padding: 0.75rem;
		display: flex;
		justify-content: center;
	}
	.secondary {
		background: #e9ecef;
	}
</style>
