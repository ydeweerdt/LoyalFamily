<script lang="ts">
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
		onsave,
		oncancel
	}: {
		initial: CardFormValues;
		submitLabel: string;
		onsave: (values: CardFormValues) => Promise<void>;
		oncancel: () => void;
	} = $props();

	let values = $state<CardFormValues>({ ...initial });
	let errorMsg = $state('');
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		errorMsg = '';
		try {
			await onsave(values);
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Save failed';
		}
		busy = false;
	}
</script>

<form onsubmit={submit}>
	<label>
		Name
		<input name="name" bind:value={values.name} maxlength={64} required />
	</label>
	<label>
		Color
		<input name="color" type="color" bind:value={values.color} />
	</label>
	<label>
		Barcode value
		<input name="barcode_value" bind:value={values.barcode_value} maxlength={512} required />
	</label>
	<label>
		Symbology
		<select name="symbology" bind:value={values.symbology}>
			{#each SYMBOLOGIES as s}
				<option value={s}>{s}</option>
			{/each}
		</select>
	</label>
	<label class="check">
		<input name="visibility" type="checkbox" checked={values.visibility === 'shared'}
			onchange={(e) => (values.visibility = (e.currentTarget as HTMLInputElement).checked ? 'shared' : 'private')} />
		Shared with the family (unchecked = private)
	</label>
	<label>
		Comment (optional — distinguishes multiple cards of the same brand)
		<input name="comment" bind:value={values.comment} maxlength={200} />
	</label>
	<div class="row">
		<button disabled={busy}>{submitLabel}</button>
		<button type="button" class="secondary" onclick={oncancel}>Cancel</button>
	</div>
	{#if errorMsg}<p class="error">{errorMsg}</p>{/if}
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
	.error {
		color: #c92a2a;
	}
</style>
