<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import CardForm, { type CardFormValues } from '$lib/components/CardForm.svelte';
	import Scanner from '$lib/components/Scanner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { monogram, searchBrands, type Brand } from '$lib/brands';
	import { addCard } from '$lib/stores/cards';
	import { uuid } from '$lib/domain/uuid';
	import { refreshSession, session } from '$lib/stores/session';
	import { t } from '$lib/i18n.svelte';

	let query = $state('');
	let picked = $state<Brand | 'unknown' | null>(null);
	let scanning = $state(false);
	let scanned = $state<{ value: string; symbology: string } | null>(null);
	const brands = $derived(searchBrands(query));

	onMount(() => refreshSession());

	function pick(brand: Brand | 'unknown') {
		picked = brand;
		scanned = null;
		scanning = true; // scanner starts immediately (Roadmap: card addition)
	}

	function initialFor(brand: Brand | 'unknown'): CardFormValues {
		const base =
			brand === 'unknown'
				? {
						name: '',
						color: '#495057',
						barcode_value: '',
						symbology: 'EAN_13',
						visibility: 'private' as const,
						comment: ''
					}
				: {
						name: brand.name,
						color: brand.color,
						barcode_value: '',
						symbology: brand.symbology_hint ?? 'EAN_13',
						visibility: 'private' as const,
						comment: ''
					};
		if (scanned) {
			base.barcode_value = scanned.value;
			base.symbology = scanned.symbology;
		}
		return base;
	}

	async function create(values: CardFormValues) {
		const res = await addCard({
			id: uuid(),
			brand_id: picked && picked !== 'unknown' ? picked.id : null,
			...values
		});
		if (!res.ok) throw new Error(res.error);
		await goto('/');
	}
</script>

{#if !$session.user}
	<p><a href="/login">{t('sign_in_to_add')}</a></p>
{:else if picked === null}
	<h1>{t('add_card')}</h1>
	<input class="field" type="search" placeholder={t('search_brand')} bind:value={query} autocomplete="off" />
	{#if brands.length === 0}
		<p>{t('no_brand_match')}</p>
	{/if}
	<div class="grid">
		{#each brands as brand (brand.id)}
			<button class="tile" style="background:{brand.color}" onclick={() => pick(brand)}>
				<span class="mono">{monogram(brand.name)}</span>
				<span class="label">{brand.name}</span>
			</button>
		{/each}
		<button class="tile unknown" onclick={() => pick('unknown')}>
			<span class="mono"><Icon name="help" size={28} /></span>
			<span class="label">{t('unknown')}</span>
		</button>
	</div>
{:else}
	{#if scanning}
		<Scanner
			symbologyHint={picked === 'unknown' ? undefined : picked.symbology_hint}
			ondetect={(value, symbology) => {
				scanned = { value, symbology };
				scanning = false;
			}}
			onmanual={() => (scanning = false)}
			onclose={() => goto('/')}
		/>
	{:else}
		<h1>{t('add_card')} — {picked === 'unknown' ? t('custom') : picked.name}</h1>
		<button class="btn" onclick={() => (picked = null)}>{t('choose_another')}</button>
		<CardForm
			initial={initialFor(picked)}
			submitLabel={t('add_card')}
			symbologyHint={picked === 'unknown' ? undefined : picked.symbology_hint}
			onsave={create}
			oncancel={() => goto('/')}
		/>
	{/if}
{/if}

<style>
	.tile.unknown {
		background: var(--surface-2);
		color: var(--text-muted);
	}
</style>
