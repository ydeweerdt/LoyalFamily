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

<form onsubmit={submit} autocomplete="off">
	<label class="field-label">
		{t('name')}
		<input class="field" name="name" bind:value={values.name} maxlength={64} required autocomplete="off" data-1p-ignore />
	</label>
	<label class="field-label">
		{t('color')}
		<input class="swatch" name="color" type="color" bind:value={values.color} />
	</label>
	<label class="field-label">
		{t('barcode_value')}
		<div class="barrow">
			<input
				class="field"
				name="barcode_value"
				bind:value={values.barcode_value}
				maxlength={512}
				required
				autocomplete="off"
				inputmode="numeric"
				autocorrect="off"
				autocapitalize="off"
				spellcheck={false}
				data-1p-ignore
			/>
			<button type="button" class="btn btn-primary icon-btn" aria-label={t('scan_barcode')} title={t('scan_barcode')} onclick={() => (scanning = true)}>
				<Icon name="scan" />
			</button>
		</div>
	</label>
	{#if ean13Bad}
		<p class="warn">{t('ean13_warn')}</p>
	{/if}
	<label class="field-label">
		{t('symbology')}
		<select class="field" name="symbology" bind:value={values.symbology}>
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
	<label class="field-label">
		{t('comment_hint')}
		<input class="field" name="comment" bind:value={values.comment} maxlength={200} autocomplete="off" data-1p-ignore />
	</label>
	<div class="row">
		<button class="btn btn-primary" disabled={busy}>{submitLabel}</button>
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
	.swatch {
		height: 44px;
		width: 100%;
		padding: 0.15rem;
		box-sizing: border-box;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
	}
	.check {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.95rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.barrow {
		display: flex;
		gap: 0.4rem;
	}
	.barrow input {
		flex: 1;
	}
</style>
