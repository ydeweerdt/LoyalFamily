<script lang="ts">
	import JsBarcode from 'jsbarcode';
	import { isWriterRendered, svg2d } from '$lib/domain/render';
	import { symbologyValueError, validEan13Checksum } from '$lib/domain/validation';
	import { t } from '$lib/i18n.svelte';

	/**
	 * Renders a barcode as SVG.
	 * 1D symbologies → JsBarcode; QR / AZTEC / DATA_MATRIX → @zxing/library writers
	 * (see $lib/domain/render) — the same library that scans them, so a scanned value
	 * re-renders as the symbol it came from.
	 * If the value is invalid for the symbology, falls back to showing the raw value
	 * (a readable number is still better than a broken barcode at the checkout).
	 */
	let {
		value,
		symbology,
		height = 90
	}: {
		value: string;
		symbology: string;
		height?: number;
	} = $props();

	let svgEl = $state<SVGSVGElement | undefined>();
	let html = $state('');
	let error = $state('');

	// shape is fine but the check digit is not: allowed by design (REQUIREMENTS §5a),
	// so say what it is instead of the generic "invalid value"
	const badCheckDigit = $derived(
		symbology === 'EAN_13' && symbologyValueError(value, symbology) === undefined && !validEan13Checksum(value)
	);

	// JsBarcode format names
	const FORMAT: Record<string, string> = {
		EAN_13: 'ean13',
		EAN_8: 'ean8',
		UPC_A: 'upc',
		UPC_E: 'upce',
		CODE_128: 'code128',
		CODE_39: 'code39',
		CODE_93: 'code93',
		ITF: 'itf',
		CODABAR: 'codabar'
	};

	$effect(() => {
		error = '';
		html = '';
		if (isWriterRendered(symbology)) {
			try {
				html = svg2d(value, symbology);
			} catch {
				error = `Cannot render ${symbology} from this value`;
			}
			return;
		}
		if (!FORMAT[symbology]) {
			error = `${symbology} cannot be drawn here — read the value instead`;
			return;
		}
		if (!svgEl) return;
		try {
			JsBarcode(svgEl, value, {
				format: FORMAT[symbology] ?? 'code128',
				width: 2,
				height,
				margin: 10,
				fontSize: 16,
				valid: (v: boolean) => {
					if (!v) error = badCheckDigit ? t('ean13_warn') : `Invalid value for ${symbology}`;
				}
			});
		} catch {
			error = `Cannot render ${symbology} from this value`;
		}
	});
</script>

{#if error}
	<p class="error">{error}</p>
	<code class="fallback">{value}</code>
{:else if html}
	{@html html}
{:else}
	<svg bind:this={svgEl} role="img" aria-label="{symbology} barcode"></svg>
{/if}

<style>
	.fallback {
		display: block;
		font-size: 1.1rem;
		word-break: break-all;
		text-align: center;
	}
	svg {
		max-width: 100%;
	}
</style>
