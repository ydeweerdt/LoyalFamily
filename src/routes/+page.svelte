<script lang="ts">
	import { onMount } from 'svelte';
	import CardForm, { type CardFormValues } from '$lib/components/CardForm.svelte';
	import BarcodeView from '$lib/components/BarcodeView.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { getBrand, inkOn, monogram } from '$lib/brands';
	import { filterTiles, type Tile } from '$lib/domain/cards';
	import { cards, loadCards, offline, pending, failed, patchCard, removeCard, tiles } from '$lib/stores/cards';
	import { refreshSession, session } from '$lib/stores/session';
	import { t } from '$lib/i18n.svelte';
	import type { Card } from '$lib/types';

	let openTile = $state<Tile | null>(null);
	let editCard = $state<Card | null>(null);
	let barcodeCard = $state<Card | null>(null);
	let errorMsg = $state('');
	let query = $state('');
	let loading = $state(true);
	let sheet = $state<HTMLElement | null>(null);
	const shownTiles = $derived(filterTiles($tiles, query));

	onMount(async () => {
		await refreshSession();
		try {
			await loadCards();
		} finally {
			loading = false;
		}
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

	/* Sheets: lock background scroll, focus the sheet when it opens, keep Tab inside it, close on Escape. */
	$effect(() => {
		const open = barcodeCard ?? editCard ?? openTile;
		document.body.style.overflow = open ? 'hidden' : '';
		if (open) queueMicrotask(() => sheet?.querySelector<HTMLElement>('button, a[href], input, select')?.focus());
	});

	function onKeydown(e: KeyboardEvent) {
		if (barcodeCard) return; // BarcodeView closes itself
		if (!editCard && !openTile) return;
		if (e.key === 'Escape') {
			if (editCard) editCard = null;
			else openTile = null;
			return;
		}
		if (e.key !== 'Tab' || !sheet) return;
		const items = [...sheet.querySelectorAll<HTMLElement>('button, a[href], input, select')].filter((el) => !el.hasAttribute('disabled'));
		if (items.length === 0) return;
		const first = items[0];
		const last = items[items.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if $session.user}
	<h1>{t('cards')}</h1>

	{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

	{#if $offline || $failed > 0}
		<p class="offline">
			{#if $offline}<Icon name="warning" size={16} /> {t('offline')}{$pending > 0 ? ` ${$pending} ${t('changes_waiting')}.` : ''}{/if}
			{#if $failed > 0}<span class="failed"><Icon name="warning" size={16} /> {$failed} {t('changes_failed')}.</span>{/if}
		</p>
	{/if}

	{#if loading && $tiles.length === 0}
		<div class="grid">
			{#each [1, 2, 3] as i}<span class="tile skeleton"></span>{/each}
		</div>
	{:else if $tiles.length === 0}
		<p>{t('no_cards')}</p>
	{:else}
		<input class="field" type="search" placeholder={t('search_cards')} bind:value={query} autocomplete="off" />
		{#if shownTiles.length === 0}
			<p>{t('no_match')} “{query}”.</p>
		{:else}
		<div class="grid">
			{#each shownTiles as tile (tile.key)}
				<button
					class="tile"
					style="background:{tile.color};color:{inkOn(tile.color)}"
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
					{#if tile.hasMyPrivate}<span class="badge lock"><Icon name="lock" size={13} /></span>{/if}
				</button>
			{/each}
		</div>
		{/if}
	{/if}

	{#if openTile && !editCard}
		<button class="scrim" aria-label={t('close')} onclick={() => (openTile = null)}></button>
		<div class="sheet" role="dialog" aria-modal="true" aria-label={openTile.name} bind:this={sheet}>
			<h2>{openTile.name}</h2>
			<div class="grid">
				{#each openTile.cards as card (card.id)}
					<button
						class="tile"
						style="background:{card.color};color:{inkOn(card.color)}"
						title={t('tile_hint_single')}
						onclick={() => tapCard(card)}
						onpointerdown={() => startHoldCard(card)}
						onpointerup={cancelHold}
						onpointercancel={cancelHold}
						onpointerleave={cancelHold}
					>
						<span class="mono">{monogram(card.name)}</span>
						<span class="label">{card.comment || card.name}</span>
						{#if card.visibility === 'private' && card.owner_id === $session.user?.id}<span class="badge lock"><Icon name="lock" size={13} /></span>{/if}
					</button>
				{/each}
			</div>
			<button class="icon-btn" aria-label={t('close')} title={t('close')} onclick={() => (openTile = null)}>
				<Icon name="close" />
			</button>
		</div>
	{/if}

	{#if barcodeCard}
		<BarcodeView card={barcodeCard} onclose={() => (barcodeCard = null)} />
	{/if}

	{#if editCard}
		<button class="scrim" aria-label={t('close')} onclick={() => (editCard = null)}></button>
		<div class="sheet" role="dialog" aria-modal="true" aria-label={t('edit_card')} bind:this={sheet}>
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
				<button class="icon-btn btn-danger" aria-label={t('delete_card')} title={t('delete_card')} onclick={() => editCard && remove(editCard)}>
					<Icon name="trash" />
				</button>
			{/if}
		</div>
	{/if}

	<a href="/add" class="fab" title={t('add_card_title')} aria-label={t('add_card_title')}>
		<Icon name="add" size={26} />
	</a>
{:else}
	<h1>LoyalFamily</h1>
	<p>{t('tagline')}</p>
	<p><a href="/register">{t('register_first')}</a> {t('or')} <a href="/login">{t('sign_in')}</a>.</p>
{/if}

<style>
	.offline {
		background: var(--warn-bg);
		border: 1px solid var(--warn);
		border-radius: var(--radius-sm);
		padding: 0.6rem 0.75rem;
		font-size: 0.9rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.offline .failed {
		color: var(--danger);
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
</style>
