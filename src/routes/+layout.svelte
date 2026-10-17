<script lang="ts">
	import { onMount } from 'svelte';
	import { loadCards } from '$lib/stores/cards';
	import { logout, refreshSession, session } from '$lib/stores/session';
	import { initLang, t } from '$lib/i18n.svelte';
	import Icon from '$lib/components/Icon.svelte';
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
				<Icon name="menu" size={22} />
			</button>
			{#if menuOpen}
				<button class="backdrop" aria-label={t('close')} onclick={() => (menuOpen = false)}></button>
				<div class="menu-panel">
					<span class="who">{$session.user.display_name}</span>
					{#if $session.user.role === 'admin'}
						<a href="/admin" onclick={() => (menuOpen = false)}>{t('admin')}</a>
					{/if}
					<a href="/settings" onclick={() => (menuOpen = false)}>{t('settings')}</a>
					<button class="menu-item" onclick={() => { menuOpen = false; logout(); }}>{t('sign_out')}</button>
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
	/* Design tokens + shared classes: the only place colors, radii and z-layers are defined. */
	:global(:root) {
		--brand: #0b7285;
		--brand-ink: #ffffff;
		--surface: #ffffff;
		--surface-2: #f4f6f7;
		--line: #dee2e6;
		--text: #1c2023;
		--text-muted: #5f6b72;
		--danger: #c92a2a;
		--danger-bg: #ffe3e3;
		--ok: #2b8a3e;
		--warn: #b45309;
		--warn-bg: #fff3bf;
		--ok-bg: #d3f9d8;
		--radius: 14px;
		--radius-sm: 10px;
		--z-menu: 20;
		--z-modal: 30;
		--z-fullscreen: 40;
		--z-scanner: 50;
		--safe-t: env(safe-area-inset-top, 0px);
		--safe-b: env(safe-area-inset-bottom, 0px);
		--safe-r: env(safe-area-inset-right, 0px);
	}
	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--surface: #16191c;
			--surface-2: #23272b;
			--line: #343a40;
			--text: #e9ecef;
			--text-muted: #9aa4ab;
			--danger: #ffa8a8;
			--danger-bg: #3d1c1c;
			--ok: #8ce99a;
			--warn: #ffd8a8;
			--warn-bg: #3a2f14;
			--ok-bg: #1c3d22;
		}
	}
	:global(html),
	:global(body) {
		font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
	}
	:global(body) {
		margin: 0;
		background: var(--surface);
		color: var(--text);
	}
	:global(.btn) {
		font: inherit;
		border: none;
		border-radius: var(--radius-sm);
		padding: 0.6rem 1rem;
		min-height: 44px;
		cursor: pointer;
		background: var(--surface-2);
		color: var(--text);
	}
	:global(.icon-btn) {
		background: var(--surface-2);
		border: none;
		border-radius: var(--radius-sm);
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: var(--text);
	}
	:global(.btn-primary) {
		background: var(--brand);
		color: var(--brand-ink);
	}
	:global(.btn-danger) {
		background: var(--danger-bg);
		color: var(--danger);
	}
	:global(.field-label) {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin: 0.6rem 0;
		font-size: 0.95rem;
	}
	:global(.field) {
		display: block;
		width: 100%;
		padding: 0.65rem 0.75rem;
		min-height: 44px;
		box-sizing: border-box;
		font: inherit;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
	}
	:global(.chip) {
		font-size: 0.85rem;
		text-transform: uppercase;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--text-muted);
	}
	:global(.chip-ok) {
		background: var(--ok-bg);
		color: var(--ok);
	}
	:global(.chip-danger) {
		background: var(--danger-bg);
		color: var(--danger);
	}
	:global(.grid) {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 0.6rem;
	}
	:global(.tile) {
		position: relative;
		aspect-ratio: 1;
		border: none;
		border-radius: var(--radius);
		color: #fff;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		cursor: pointer;
		transition: transform 0.12s ease;
	}
	:global(.tile:active) {
		transform: scale(0.96);
	}
	:global(.tile.skeleton) {
		background: var(--surface-2);
	}
	:global(.mono) {
		font-size: 1.8rem;
		font-weight: 800;
		opacity: 0.95;
	}
	:global(.label) {
		font-size: 0.9rem;
		opacity: 0.92;
		max-width: 90%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(.badge) {
		position: absolute;
		font-size: 0.8rem;
		padding: 0.1rem 0.35rem;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.45);
		display: inline-flex;
		align-items: center;
	}
	:global(.badge.count) {
		top: 6px;
		right: 6px;
	}
	:global(.badge.lock) {
		top: 6px;
		left: 6px;
	}
	:global(.scrim) {
		position: fixed;
		inset: 0;
		border: none;
		padding: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: var(--z-modal);
	}
	/* bottom sheet (Catima-style) instead of a centered dialog */
	:global(.sheet) {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: calc(var(--z-modal) + 1);
		background: var(--surface);
		color: var(--text);
		border-radius: var(--radius) var(--radius) 0 0;
		padding: 1rem 1rem calc(1rem + var(--safe-b));
		max-height: 85vh;
		overflow: auto;
		animation: sheet-up 0.18s ease-out;
	}
	@keyframes sheet-up {
		from {
			transform: translateY(24px);
		}
		to {
			transform: none;
		}
	}
	:global(.fab) {
		position: fixed;
		right: calc(1rem + var(--safe-r));
		bottom: calc(1rem + var(--safe-b));
		width: 56px;
		height: 56px;
		border-radius: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--brand);
		color: var(--brand-ink);
		z-index: var(--z-menu);
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.sheet) {
			animation: none;
		}
		:global(.tile) {
			transition: none;
		}
	}
	:global(.error) {
		color: var(--danger);
	}
	:global(.ok) {
		color: var(--ok);
	}
	:global(.warn) {
		color: var(--warn);
		font-size: 0.95rem;
	}
	:global(.meta) {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	nav {
		position: sticky;
		top: 0;
		z-index: var(--z-menu);
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: calc(0.6rem + var(--safe-t)) 1rem 0.6rem;
		background: var(--brand);
		color: var(--brand-ink);
	}
	nav a.brand {
		color: var(--brand-ink);
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
		color: var(--brand-ink);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		/* nav creates the stacking context for its own backdrop/panel: keep the button clickable */
		position: relative;
		z-index: 2;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 1;
		border: none;
		background: transparent;
	}
	.menu-panel {
		position: absolute;
		top: 100%;
		right: 0.5rem;
		background: var(--surface);
		color: var(--text);
		border-radius: var(--radius);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
		min-width: 180px;
		padding: 0.4rem 0;
		display: flex;
		flex-direction: column;
		z-index: 3;
	}
	.menu-panel a,
	.menu-item {
		color: var(--text);
		text-decoration: none;
		background: none;
		border: none;
		text-align: left;
		font: inherit;
		cursor: pointer;
		padding: 0.65rem 1rem;
		min-height: 44px;
	}
	.menu-panel .who {
		color: var(--text-muted);
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--line);
	}
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: 1rem 1rem calc(1rem + var(--safe-b));
	}
</style>
