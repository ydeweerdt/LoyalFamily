<script lang="ts">
	import Scanner from '$lib/components/Scanner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { t } from '$lib/i18n.svelte';
	import { validEan13Checksum } from '$lib/domain/validation';
	import { SYMBOLOGIES } from '$lib/types';

	export type CardFormValues = {
		name: string;
		color: string;
		barcode_value: string;
		symbology: string;
		visibility: 'private' | 'shared';
		comment: string;
	};

	let {
		initial,
		submitLabel,
		symbologyHint,
		onsave,
		oncancel
	}: {
		initial: CardFormValues;
		submitLabel: string;
		symbologyHint?: string;
		onsave: (values: CardFormValues) => Promise<void>;
		oncancel: () => void;
	} = $props();

	let values = $state<CardFormValues>({ ...initial });
	let scanning = $state(false);
	let errorMsg = $state('');
	let busy = $state(false);

	const ean13Bad = $derived(
		values.symbology === 'EAN_13' && values.barcode_value.length === 13 && !validEan13Checksum(values.barcode_value)
	);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		errorMsg = '';
		try {
			await onsave(values);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : t('save_failed');
		}
		busy = false;
	}
</script>

<form onsubmit={submit}>
	<label>
		{t('name')}
		<input name="name" bind:value={values.name} maxlength={64} required />
	</label>
	<label>
		{t('color')}
		<input name="color" type="color" bind:value={values.color} />
	</label>
	<label>
		{t('barcode_value')}
		<div class="barrow">
			<input name="barcode_value" bind:value={values.barcode_value} maxlength={512} required />
			<button type="button" class="scan" aria-label={t('scan_barcode')} title={t('scan_barcode')} onclick={() => (scanning = true)}>
				<Icon name="scan" />
			</button>
		</div>
	</label>
	{#if ean13Bad}
		<p class="warn">{t('ean13_warn')}</p>
	{/if}
	<label>
		{t('symbology')}
		<select name="symbology" bind:value={values.symbology}>
			{#each SYMBOLOGIES as s}
				<option value={s}>{s}</option>
			{/each}
		</select>
	</label>
	<label class="check">
		<input name="visibility" type="checkbox" checked={values.visibility === 'shared'}
			onchange={(e) => (values.visibility = (e.currentTarget as HTMLInputElement).checked ? 'shared' : 'private')} />
			{t('shared_hint')}
	</label>
	<label>
		{t('comment_hint')}
		<input name="comment" bind:value={values.comment} maxlength={200} />
	</label>
	<div class="row">
		<button disabled={busy}>{submitLabel}</button>
		<button type="button" class="icon-btn" aria-label={t('cancel')} title={t('cancel')} onclick={oncancel}>
			<Icon name="back" />
		</button>
	</div>
	{#if errorMsg}<p class="error">{errorMsg}</p>{/if}
	{#if scanning}
		<Scanner
			symbologyHint={symbologyHint}
			ondetect={(value, symbology) => {
				values.barcode_value = value;
				values.symbology = symbology;
				scanning = false;
			}}
			onmanual={() => (scanning = false)}
			onclose={() => (scanning = false)}
		/>
	{/if}
</form>

<style>
	label {
		display: block;
		margin: 0.5rem 0;
		font-size: 0.9rem;
	}
	input:not([type='checkbox']):not([type='color']),
	select {
		display: block;
		width: 100%;
		padding: 0.4rem;
		box-sizing: border-box;
	}
	input[type='color'] {
		height: 2.2rem;
		padding: 0.1rem;
	}
	.check {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.secondary {
		background: #e9ecef;
	}
	.icon-btn {
		background: #e9ecef;
		border: none;
		border-radius: 8px;
		width: 2.2rem;
		height: 2.2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: #212529;
	}
	.barrow {
		display: flex;
		gap: 0.4rem;
	}
	.barrow input {
		flex: 1;
	}
	.scan {
		background: #0b7285;
		color: white;
		white-space: nowrap;
	}
	.warn {
		color: #b45309;
		font-size: 0.85rem;
	}
	.error {
		color: #c92a2a;
	}
</style>
