<script lang="ts">
	import { onMount } from 'svelte';
	import { loadCards } from '$lib/stores/cards';
	import { logout, refreshSession, session } from '$lib/stores/session';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		// hydrate the session on every route (offline: from the local mirror)
		void refreshSession();
	});

	onMount(() => {
		// reconnect → replay queued mutations and reconcile (DESIGN §6)
		window.addEventListener('online', () => void loadCards());
	});

	onMount(() => {
		// Service worker only for real builds (dev server + SW = confusing cache ghosts)
		if (import.meta.env.PROD && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/sw.js').catch(() => {
				/* offline support degrades gracefully */
			});
		}
	});
</script>

<nav>
	<a href="/" class="brand">LoyalFamily</a>
	<div class="actions">
		{#if $session.user}
			<span class="who">{$session.user.display_name}</span>
			{#if $session.user.role === 'admin'}<a href="/admin">Admin</a>{/if}
			<a href="/settings">Settings</a>
			<button class="link" onclick={() => logout()}>Sign out</button>
		{:else}
			<a href="/login">Sign in</a>
			<a href="/register">Register</a>
		{/if}
	</div>
</nav>

<main>
	{@render children()}
</main>

<style>
	nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 1rem;
		background: #0b7285;
		color: white;
	}
	nav a.brand {
		color: white;
		font-weight: 700;
		text-decoration: none;
	}
	.actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	.actions a {
		color: white;
	}
	.who {
		opacity: 0.85;
	}
	button.link {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		font: inherit;
	}
	main {
		max-width: 480px;
		margin: 0 auto;
		padding: 1rem;
	}
</style>
