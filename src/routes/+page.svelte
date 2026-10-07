<script lang="ts">
	import { onMount } from 'svelte';
	import CardForm, { type CardFormValues } from '$lib/components/CardForm.svelte';
	import BarcodeView from '$lib/components/BarcodeView.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { getBrand, monogram } from '$lib/brands';
	import { filterTiles, type Tile } from '$lib/domain/cards';
	import { cards, loadCards, offline, pending, patchCard, removeCard, tiles } from '$lib/stores/cards';
	import { refreshSession, session } from '$lib/stores/session';
	import { t } from '$lib/i18n.svelte';
	import type { Card } from '$lib/types';

	let openTile = $state<Tile | null>(null);
	let editCard = $state<Card | null>(null);
	let barcodeCard = $state<Card | null>(null);
	let errorMsg = $state('');
	let query = $state('');
	const shownTiles = $derived(filterTiles($tiles, query));

	onMount(async () => {
		await refreshSession();
		await loadCards();
	});

	async function saveEdit(values: CardFormValues) {
		if (!editCard) return;
		await patchCard(editCard.id, { ...values });
		editCard = null;
		openTile = null;
	}

	async function remove(card: Card) {
		if (!confirm(`Delete "${card.name}"${card.comment ? ` (${card.comment})` : ''}?`)) return;
		await removeCard(card.id);
		editCard = null;
		openTile = null;
	}

	function canManage(card: Card): boolean {
		return card.owner_id === $session.user?.id || $session.user?.role === 'admin';
	}
	function canEditCard(card: Card): boolean {
		return card.owner_id === $session.user?.id;
	}

	/* Tap semantics (REQUIREMENTS §5): single-card tile → barcode immediately;
	   multi-card tile → tile view of the stacked cards. Hold → edit (single
	   card) or tile view (stacked). In the tile view: tap → barcode, hold → edit. */
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let holdFired = false;

	function cancelHold() {
		clearTimeout(holdTimer);
	}
	function startHold(tile: Tile) {
		clearTimeout(holdTimer);
		holdFired = false;
		holdTimer = setTimeout(() => {
			holdFired = true;
			if (tile.cards.length === 1 && canEditCard(tile.cards[0])) editCard = tile.cards[0];
			else openTile = tile;
			// swallow the click that a real long-press fires on release,
			// then reset in case the tile unmounted and no click ever came
			setTimeout(() => (holdFired = false), 400);
		}, 500);
	}
	function tap(tile: Tile) {
		cancelHold();
		if (holdFired) return void (holdFired = false);
		if (tile.cards.length === 1) barcodeCard = tile.cards[0];
		else openTile = tile;
	}
	function startHoldCard(card: Card) {
		clearTimeout(holdTimer);
		holdFired = false;
		holdTimer = setTimeout(() => {
			holdFired = true;
			if (canEditCard(card)) editCard = card;
			else barcodeCard = card;
			setTimeout(() => (holdFired = false), 400);
		}, 500);
	}
	function tapCard(card: Card) {
		cancelHold();
		if (holdFired) return void (holdFired = false);
		barcodeCard = card;
	}
</script>

{#if $session.user}
	<div class="toolbar">
		<h1>{t('cards')}</h1>
		<a href="/add" class="add" title={t('add_card_title')}>＋</a>
	</div>

	{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

	{#if $offline}
		<p class="offline">
			⚠ {t('offline')}{$pending > 0 ? ` ${$pending} ${t('changes_waiting')}.` : ''}
		</p>
	{/if}

	{#if $tiles.length === 0}
		<p>{t('no_cards')}</p>
	{:else}
		{#if $tiles.length > 3}
			<input class="search" type="search" placeholder={t('search_cards')} bind:value={query} />
		{/if}
		{#if shownTiles.length === 0}
			<p>{t('no_match')} “{query}”.</p>
		{:else}
		<div class="grid">
			{#each shownTiles as tile (tile.key)}
				<button
					class="tile"
					style="background:{tile.color}"
					title={tile.cards.length === 1 ? t('tile_hint_single') : t('tile_hint_multi')}
					onclick={() => tap(tile)}
					onpointerdown={() => startHold(tile)}
					onpointerup={cancelHold}
					onpointercancel={cancelHold}
					onpointerleave={cancelHold}
				>
					<span class="mono">{monogram(tile.name)}</span>
					<span class="label">{tile.name}</span>
					{#if tile.count > 1}<span class="badge count">{tile.count}</span>{/if}
					{#if tile.hasMyPrivate}<span class="badge lock">🔒</span>{/if}
				</button>
			{/each}
		</div>
		{/if}
	{/if}

	{#if openTile && !editCard}
		<div class="modal" role="dialog" aria-label={openTile.name}>
			<div class="modal-body">
				<h2>{openTile.name}</h2>
				<div class="grid">
					{#each openTile.cards as card (card.id)}
						<button
							class="tile"
							style="background:{card.color}"
							title={t('tile_hint_single')}
							onclick={() => tapCard(card)}
							onpointerdown={() => startHoldCard(card)}
							onpointerup={cancelHold}
							onpointercancel={cancelHold}
							onpointerleave={cancelHold}
						>
							<span class="mono">{monogram(card.name)}</span>
							<span class="label">{card.comment || card.name}</span>
							{#if card.visibility === 'private' && card.owner_id === $session.user?.id}<span class="badge lock">🔒</span>{/if}
						</button>
					{/each}
				</div>
				<button class="icon-btn" aria-label={t('close')} title={t('close')} onclick={() => (openTile = null)}>
					<Icon name="back" />
				</button>
			</div>
		</div>
	{/if}

	{#if barcodeCard}
		<BarcodeView card={barcodeCard} onclose={() => (barcodeCard = null)} />
	{/if}

	{#if editCard}
		<div class="modal" role="dialog" aria-label={t('edit_card')}>
			<div class="modal-body">
				<h2><Icon name="pencil" size={18} /> {t('edit_card')}</h2>
				<CardForm
					initial={{
						name: editCard.name,
						color: editCard.color,
						barcode_value: editCard.barcode_value,
						symbology: editCard.symbology,
						visibility: editCard.visibility,
						comment: editCard.comment ?? ''
					}}
					submitLabel={t('save')}
					symbologyHint={editCard.brand_id ? getBrand(editCard.brand_id)?.symbology_hint : undefined}
					onsave={saveEdit}
					oncancel={() => (editCard = null)}
				/>
				{#if canManage(editCard)}
					<button class="icon-btn danger" aria-label={t('delete_card')} title={t('delete_card')} onclick={() => editCard && remove(editCard)}>
						<Icon name="trash" />
					</button>
				{/if}
			</div>
		</div>
	{/if}
{:else}
	<h1>LoyalFamily</h1>
	<p>{t('tagline')}</p>
	<p><a href="/register">{t('register_first')}</a> {t('or')} <a href="/login">{t('sign_in')}</a>.</p>
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
	.search {
		width: 100%;
		padding: 0.5rem;
		box-sizing: border-box;
		margin-bottom: 0.75rem;
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
	.meta {
		display: block;
		font-size: 0.75rem;
		color: #666;
	}
	.danger {
		background: #c92a2a;
		color: white;
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
	.icon-btn.danger {
		background: #c92a2a;
		color: white;
	}
	.secondary {
		background: #e9ecef;
		margin-top: 0.5rem;
	}
	.offline {
		background: #fff3bf;
		border: 1px solid #ffd84d;
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		font-size: 0.85rem;
	}
	.error {
		color: #c92a2a;
	}
</style>
