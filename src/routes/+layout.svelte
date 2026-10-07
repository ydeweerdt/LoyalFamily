<script lang="ts">
	import { onMount } from 'svelte';
	import { loadCards } from '$lib/stores/cards';
	import { logout, refreshSession, session } from '$lib/stores/session';
	import { initLang, t } from '$lib/i18n.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	let menuOpen = $state(false);
	initLang();

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
			<button
				class="menu-btn"
				aria-label={t('menu')}
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
					<path fill="currentColor" d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
				</svg>
			</button>
			{#if menuOpen}
				<div class="backdrop" onclick={() => (menuOpen = false)}></div>
				<div class="menu-panel">
					<span class="who">{$session.user.display_name}</span>
					{#if $session.user.role === 'admin'}
						<a href="/admin" onclick={() => (menuOpen = false)}>{t('admin')}</a>
					{/if}
					<a href="/settings" onclick={() => (menuOpen = false)}>{t('settings')}</a>
					<button onclick={() => { menuOpen = false; logout(); }}>{t('sign_out')}</button>
				</div>
			{/if}
		{:else}
			<a href="/login">{t('sign_in')}</a>
			<a href="/register">{t('register')}</a>
		{/if}
	</div>
</nav>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)} />

<main>
	{@render children()}
</main>

<style>
	nav {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 1rem;
		background: #0b7285;
		color: white;
		border: none;
		box-shadow: none;
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
	.menu-btn {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		padding: 0.2rem;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
	}
	.menu-panel {
		position: absolute;
		top: 100%;
		right: 0.5rem;
		background: white;
		color: #212529;
		border-radius: 10px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
		min-width: 180px;
		padding: 0.4rem 0;
		display: flex;
		flex-direction: column;
		z-index: 100;
	}
	.menu-panel a {
		color: #212529;
		text-decoration: none;
		padding: 0.55rem 1rem;
	}
	.menu-panel .who {
		color: #666;
		font-size: 0.85rem;
		padding: 0.4rem 1rem;
		border-bottom: 1px solid #eee;
	}
	.menu-item {
		background: none;
		border: none;
		text-align: left;
		font: inherit;
		cursor: pointer;
		padding: 0.55rem 1rem;
		color: #212529;
	}
	main {
		max-width: 480px;
		margin: 0 auto;
		padding: 1rem;
	}
</style>
