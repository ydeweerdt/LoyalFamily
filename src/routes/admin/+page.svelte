<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { refreshSession, session } from '$lib/stores/session';
	import { t, tf } from '$lib/i18n.svelte';
	import type { PublicUser } from '$lib/types';

	interface InviteRow {
		id: string;
		token: string;
		expires_at: string;
		used_at: string | null;
		expired: boolean;
	}

	let users = $state<PublicUser[]>([]);
	let invites = $state<InviteRow[]>([]);
	let errorMsg = $state('');
	let newInviteUrl = $state('');
	type ActionKind = 'menu' | 'role' | 'reset' | 'delete';
	let action = $state<{ user: PublicUser; kind: ActionKind } | null>(null);
	let newPassword = $state('');

	const isAdmin = $derived($session.user?.role === 'admin');

	onMount(async () => {
		await refreshSession();
		if (isAdmin) await load();
	});

	async function load() {
		const [u, i] = await Promise.all([fetch('/api/admin/users', { credentials: 'same-origin' }), fetch('/api/admin/invites', { credentials: 'same-origin' })]);
		if (!u.ok || !i.ok) {
			errorMsg = t('admin_load_failed');
			return;
		}
		users = (await u.json()).users;
		invites = (await i.json()).invites;
	}

	async function api(url: string, method: string, body?: unknown) {
		const r = await fetch(url, {
			method,
			credentials: 'same-origin',
			headers: body ? { 'content-type': 'application/json' } : undefined,
			body: body ? JSON.stringify(body) : undefined
		});
		if (!r.ok) errorMsg = (await r.json()).error;
		return r.ok;
	}

	async function createInvite() {
		errorMsg = '';
		const r = await fetch('/api/admin/invites', { method: 'POST', credentials: 'same-origin' });
		if (!r.ok) return void (errorMsg = (await r.json()).error);
		const invite = await r.json();
		newInviteUrl = `${location.origin}/join/${invite.token}`;
		await load();
	}

	async function revoke(id: string) {
		if (await api(`/api/admin/invites/${id}`, 'DELETE')) await load();
	}

	/* confirm()/prompt() replaced by an in-page action sheet */
	async function runAction() {
		if (!action) return;
		const u = action.user;
		const ok =
			action.kind === 'role'
				? await api(`/api/admin/users/${u.id}`, 'PUT', { role: u.role === 'admin' ? 'user' : 'admin' })
				: action.kind === 'reset'
					? await api(`/api/admin/users/${u.id}/password`, 'PUT', { password: newPassword })
					: await api(`/api/admin/users/${u.id}`, 'DELETE');
			if (!ok && action.kind === 'reset') return; // keep the sheet open so the error is fixable
		newPassword = '';
		action = null;
		if (ok) await load();
	}
	function inviteStatus(i: InviteRow): string {
		return i.used_at ? t('status_used') : i.expired ? t('status_expired') : t('status_active');
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (action = null)} />

{#if !$session.user}
	<p><a href="/login">{t('sign_in_first')}</a></p>
{:else if !isAdmin}
	<p>{t('admin_only')}</p>
{:else}
	<h1>{t('admin')}</h1>

	{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

	<section class="card">
		<h2>{t('invite_people')}</h2>
		<button class="btn btn-primary" onclick={createInvite}>{t('create_invite')}</button>
		{#if newInviteUrl}
			<p class="invite">{t('invite_share')}<br />
				<code>{newInviteUrl}</code></p>
		{/if}
		{#if invites.length === 0}<p class="meta">{t('no_invites')}</p>{/if}
		{#each invites as i (i.id)}
			<div class="list-row">
				<span class="chip {i.used_at ? '' : i.expired ? 'chip-danger' : 'chip-ok'}">{inviteStatus(i)}</span>
				<span class="meta">{tf('expires', { date: i.expires_at.slice(0, 10) })}</span>
				{#if !i.used_at && !i.expired}<button class="btn btn-danger" onclick={() => revoke(i.id)}>{t('revoke')}</button>{/if}
			</div>
		{/each}
	</section>

	<section class="card">
		<h2>{t('people')}</h2>
		{#each users as u (u.id)}
			<div class="list-row">
				<span>{u.display_name}</span>
				<span class="meta">@{u.username} · {u.role === 'admin' ? t('role_admin') : t('role_user')}</span>
				<button class="icon-btn" aria-label={t('actions')} title={t('actions')} onclick={() => (action = { user: u, kind: 'menu' })}>
					<Icon name="more" />
				</button>
			</div>
		{/each}
	</section>

	{#if action}
		{@const a = action}
		<button class="scrim" aria-label={t('close')} onclick={() => (action = null)}></button>
		<div class="sheet" role="dialog" aria-modal="true" aria-label={t('actions')}>
			<h2>{a.user.display_name}</h2>
			<p class="meta">@{a.user.username} · {a.user.role === 'admin' ? t('role_admin') : t('role_user')}</p>
			{#if a.kind === 'menu'}
				<div class="sheet-actions">
					<button class="btn" onclick={() => (action = { user: a.user, kind: 'role' })}>{a.user.role === 'admin' ? t('demote') : t('promote')}</button>
					<button class="btn" onclick={() => (action = { user: a.user, kind: 'reset' })}>{t('reset_password')}</button>
					{#if a.user.id !== $session.user?.id}
						<button class="btn btn-danger" onclick={() => (action = { user: a.user, kind: 'delete' })}>{t('delete')}</button>
					{/if}
					<button class="btn" onclick={() => (action = null)}>{t('cancel')}</button>
				</div>
			{:else}
				<p>
					{a.kind === 'reset'
						? tf('prompt_password', { name: a.user.display_name })
						: tf(a.kind === 'delete' ? 'confirm_delete' : a.user.role === 'admin' ? 'confirm_demote' : 'confirm_promote', { name: a.user.display_name })}
				</p>
				{#if a.kind === 'reset'}
					<label class="field-label">{t('new_password')} <input class="field" type="password" minlength={8} bind:value={newPassword} autocomplete="new-password" /></label>
				{/if}
				<div class="sheet-actions">
					<button class="btn btn-primary" onclick={runAction}>
						{a.kind === 'reset' ? t('save') : a.kind === 'delete' ? t('delete') : a.user.role === 'admin' ? t('demote') : t('promote')}
					</button>
					<button class="btn" onclick={() => (action = null)}>{t('cancel')}</button>
				</div>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.invite code {
		word-break: break-all;
		background: var(--surface-2);
		padding: 0.2rem 0.4rem;
		border-radius: var(--radius-sm);
	}
</style>
