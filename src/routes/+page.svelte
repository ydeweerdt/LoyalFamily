<script lang="ts">
	import { onMount } from 'svelte';
	import CardForm, { type CardFormValues } from '$lib/components/CardForm.svelte';
	import BarcodeView from '$lib/components/BarcodeView.svelte';
	import { getBrand, monogram } from '$lib/brands';
	import { buildTiles, type Tile } from '$lib/domain/cards';
	import { refreshSession, session } from '$lib/stores/session';
	import type { Card } from '$lib/types';

	let cards = $state<Card[]>([]);
	let openTile = $state<Tile | null>(null);
	let editCard = $state<Card | null>(null);
	let barcodeCard = $state<Card | null>(null);
	let errorMsg = $state('');

	const tiles = $derived($session.user ? buildTiles(cards, $session.user) : []);

	onMount(async () => {
		await refreshSession();
		await load();
	});

	async function load() {
		if (!$session.user) return;
		const r = await fetch('/api/cards', { credentials: 'same-origin' });
		if (r.ok) cards = (await r.json()).cards;
	}

	async function saveEdit(values: CardFormValues) {
		if (!editCard) return;
		const r = await fetch(`/api/cards/${editCard.id}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(values),
			credentials: 'same-origin'
		});
		if (!r.ok) throw new Error((await r.json()).error);
		editCard = null;
		openTile = null;
		await load();
	}

	async function remove(card: Card) {
		if (!confirm(`Delete "${card.name}"${card.comment ? ` (${card.comment})` : ''}?`)) return;
		const r = await fetch(`/api/cards/${card.id}`, { method: 'DELETE', credentials: 'same-origin' });
		if (!r.ok) errorMsg = (await r.json()).error;
		await load();
	}

	function canManage(card: Card): boolean {
		return card.owner_id === $session.user?.id || $session.user?.role === 'admin';
	}
	function canEditCard(card: Card): boolean {
		return card.owner_id === $session.user?.id;
	}
</script>

{#if $session.user}
	<div class="toolbar">
		<h1>Cards</h1>
		<a href="/add" class="add" title="Add card">＋</a>
	</div>

	{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

	{#if tiles.length === 0}
		<p>No cards yet — tap <b>＋</b> to add your first loyalty card.</p>
	{:else}
		<div class="grid">
			{#each tiles as tile (tile.key)}
				<button class="tile" style="background:{tile.color}" onclick={() => (openTile = tile)}>
					<span class="mono">{monogram(tile.name)}</span>
					<span class="label">{tile.name}</span>
					{#if tile.count > 1}<span class="badge count">{tile.count}</span>{/if}
					{#if tile.hasMyPrivate}<span class="badge lock">🔒</span>{/if}
				</button>
			{/each}
		</div>
	{/if}

	{#if openTile && !editCard}
		<div class="modal" role="dialog" aria-label={openTile.name}>
			<div class="modal-body">
				<h2>{openTile.name}</h2>
				<ul class="cards">
					{#each openTile.cards as card (card.id)}
						<li>
							<div class="card-info">
								<b>{card.comment || card.name}</b>
								<span class="meta">
									{card.symbology} · {card.visibility === 'shared' ? 'shared' : '🔒 private'}
									{card.owner_id === $session.user?.id ? '' : ` · by ${card.owner_id.slice(0, 4)}`}
								</span>
							</div>
							<div class="card-actions">
								<button onclick={() => (barcodeCard = card)}>Barcode</button>
								{#if canEditCard(card)}
									<button onclick={() => (editCard = card)}>Edit</button>
								{/if}
								{#if canManage(card)}
									<button class="danger" onclick={() => remove(card)}>Delete</button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
				<button class="secondary" onclick={() => (openTile = null)}>Close</button>
			</div>
		</div>
	{/if}

	{#if barcodeCard}
		<BarcodeView card={barcodeCard} onclose={() => (barcodeCard = null)} />
	{/if}

	{#if editCard}
		<div class="modal" role="dialog" aria-label="Edit card">
			<div class="modal-body">
				<h2>Edit card</h2>
				<CardForm
					initial={{
						name: editCard.name,
						color: editCard.color,
						barcode_value: editCard.barcode_value,
						symbology: editCard.symbology,
						visibility: editCard.visibility,
						comment: editCard.comment ?? ''
					}}
					submitLabel="Save"
					symbologyHint={editCard.brand_id ? getBrand(editCard.brand_id)?.symbology_hint : undefined}
					onsave={saveEdit}
					oncancel={() => (editCard = null)}
				/>
			</div>
		</div>
	{/if}
{:else}
	<h1>LoyalFamily</h1>
	<p>Your family loyalty cards — private, self-hosted, offline-ready.</p>
	<p><a href="/register">Register the first (admin) account</a> or <a href="/login">sign in</a>.</p>
{/if}

<style>
	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.add {
		font-size: 1.6rem;
		text-decoration: none;
		background: #0b7285;
		color: white;
		border-radius: 8px;
		width: 2.2rem;
		height: 2.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
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
	.mono {
		font-size: 1.8rem;
		font-weight: 800;
		opacity: 0.95;
	}
	.label {
		font-size: 0.75rem;
		opacity: 0.9;
		max-width: 90%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.badge {
		position: absolute;
		font-size: 0.7rem;
		padding: 0.1rem 0.35rem;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.45);
	}
	.badge.count {
		top: 6px;
		right: 6px;
	}
	.badge.lock {
		top: 6px;
		left: 6px;
	}
	.modal {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}
	.modal-body {
		background: white;
		border-radius: 12px;
		padding: 1rem;
		width: 100%;
		max-width: 420px;
		max-height: 85vh;
		overflow: auto;
	}
	.cards {
		list-style: none;
		padding: 0;
	}
	.cards li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid #eee;
	}
	.meta {
		display: block;
		font-size: 0.75rem;
		color: #666;
	}
	.danger {
		background: #c92a2a;
		color: white;
	}
	.secondary {
		background: #e9ecef;
		margin-top: 0.5rem;
	}
	.error {
		color: #c92a2a;
	}
</style>
