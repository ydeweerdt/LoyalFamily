<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import CardForm, { type CardFormValues } from '$lib/components/CardForm.svelte';
	import { monogram, searchBrands, type Brand } from '$lib/brands';
	import { addCard } from '$lib/stores/cards';
	import { refreshSession, session } from '$lib/stores/session';

	let query = $state('');
	let picked = $state<Brand | 'unknown' | null>(null);
	const brands = $derived(searchBrands(query));

	onMount(() => refreshSession());

	function initialFor(brand: Brand | 'unknown'): CardFormValues {
		if (brand === 'unknown') {
			return {
				name: '',
				color: '#495057',
				barcode_value: '',
				symbology: 'EAN_13',
				visibility: 'private',
				comment: ''
			};
		}
		return {
			name: brand.name,
			color: brand.color,
			barcode_value: '',
			symbology: brand.symbology_hint ?? 'EAN_13',
			visibility: 'private',
			comment: ''
		};
	}

	async function create(values: CardFormValues) {
		const res = await addCard({
			id: crypto.randomUUID(),
			brand_id: picked && picked !== 'unknown' ? picked.id : null,
			...values
		});
		if (!res.ok) throw new Error(res.error);
		await goto('/');
	}
</script>

{#if !$session.user}
	<p><a href="/login">Sign in</a> to add cards.</p>
{:else if picked === null}
	<h1>Add card</h1>
	<input class="search" type="search" placeholder="Search brand or store…" bind:value={query} />
	<div class="grid">
		{#each brands as brand (brand.id)}
			<button class="tile" style="background:{brand.color}" onclick={() => (picked = brand)}>
				<span class="mono">{monogram(brand.name)}</span>
				<span class="label">{brand.name}</span>
			</button>
		{/each}
		<button class="tile unknown" onclick={() => (picked = 'unknown')}>
			<span class="mono">?</span>
			<span class="label">Unknown</span>
		</button>
	</div>
{:else}
	<h1>Add card — {picked === 'unknown' ? 'custom' : picked.name}</h1>
	<button class="secondary" onclick={() => (picked = null)}>← choose another brand</button>
	<CardForm
		initial={initialFor(picked)}
		submitLabel="Add card"
		symbologyHint={picked === 'unknown' ? undefined : picked.symbology_hint}
		onsave={create}
		oncancel={() => goto('/')}
	/>
{/if}

<style>
	.search {
		width: 100%;
		padding: 0.5rem;
		box-sizing: border-box;
		margin-bottom: 0.75rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.6rem;
	}
	.tile {
		position: relative;
		aspect-ratio: 1;
		border: none;
		border-radius: 10px;
		color: white;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		cursor: pointer;
	}
	.tile.unknown {
		background: #adb5bd;
	}
	.mono {
		font-size: 1.8rem;
		font-weight: 800;
	}
	.label {
		font-size: 0.75rem;
		opacity: 0.9;
		max-width: 90%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.secondary {
		background: #e9ecef;
		margin-bottom: 0.5rem;
	}
</style>
