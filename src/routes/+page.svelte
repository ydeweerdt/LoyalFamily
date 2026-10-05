<script lang="ts">
	import { refreshSession, session } from '$lib/stores/session';
	import { onMount } from 'svelte';

	onMount(() => refreshSession());

	let cards = $state<{ name: string }[]>([]);
	$effect(() => {
		if ($session.user) {
			fetch('/api/cards', { credentials: 'same-origin' })
				.then((r) => (r.ok ? r.json() : { cards: [] }))
				.then((d) => (cards = d.cards));
		} else {
			cards = [];
		}
	});
</script>

{#if !$session.loaded}
	<p>Loading…</p>
{:else if $session.user}
	<h1>Cards</h1>
	{#if cards.length === 0}
		<p>No cards yet — card grid arrives in milestone 2.</p>
	{:else}
		<ul>
			{#each cards as card}
				<li>{card.name}</li>
			{/each}
		</ul>
	{/if}
{:else}
	<h1>LoyalFamily</h1>
	<p>Your family loyalty cards — private, self-hosted, offline-ready.</p>
	<p><a href="/register">Register the first (admin) account</a> or <a href="/login">sign in</a>.</p>
{/if}
