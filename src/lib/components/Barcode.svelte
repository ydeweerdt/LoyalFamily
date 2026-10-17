<script lang="ts">
	import JsBarcode from 'jsbarcode';
	import QRCode from 'qrcode';

	/**
	 * Renders a barcode as SVG.
	 * 1D symbologies → JsBarcode; QR → node-qrcode (browser-safe svg output).
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
	let qrSvg = $state('');
	let error = $state('');

	const isQr = $derived(symbology === 'QR');

	// JsBarcode format names
	const FORMAT: Record<string, string> = {
		EAN_13: 'ean13',
		UPC_A: 'upc',
		CODE_128: 'code128',
		CODE_39: 'code39'
	};

	$effect(() => {
		error = '';
		qrSvg = '';
		if (isQr) {
			QRCode.toString(value, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })
				.then((s) => (qrSvg = s))
				.catch(() => (error = 'Could not render QR code'));
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
					if (!v) error = `Invalid value for ${symbology}`;
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
{:else if isQr}
	{@html qrSvg}
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
