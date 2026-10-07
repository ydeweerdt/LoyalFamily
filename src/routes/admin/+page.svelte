<script lang="ts">
	import { onMount } from 'svelte';
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

	async function toggleRole(u: PublicUser) {
		const role = u.role === 'admin' ? 'user' : 'admin';
		if (!confirm(tf(role === 'admin' ? 'confirm_demote' : 'confirm_promote', { name: u.display_name }))) return;
		if (await api(`/api/admin/users/${u.id}`, 'PUT', { role })) await load();
	}

	async function resetPassword(u: PublicUser) {
		const password = prompt(tf('prompt_password', { name: u.display_name }));
		if (!password) return;
		if (await api(`/api/admin/users/${u.id}/password`, 'PUT', { password })) await load();
	}

	async function removeUser(u: PublicUser) {
		if (!confirm(tf('confirm_delete', { name: u.display_name }))) return;
		if (await api(`/api/admin/users/${u.id}`, 'DELETE')) await load();
	}

	function inviteStatus(i: InviteRow): string {
		return i.used_at ? t('status_used') : i.expired ? t('status_expired') : t('status_active');
	}
</script>

{#if !$session.user}
	<p><a href="/login">{t('sign_in_first')}</a></p>
{:else if !isAdmin}
	<p>{t('admin_only')}</p>
{:else}
	<h1>{t('admin')}</h1>

	{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

	<h2>{t('invite_people')}</h2>
	<button onclick={createInvite}>{t('create_invite')}</button>
	{#if newInviteUrl}
		<p class="invite">{t('invite_share')}<br />
			<code>{newInviteUrl}</code></p>
	{/if}
	<ul class="invites">
		{#if invites.length === 0}<li class="meta">{t('no_invites')}</li>{/if}
		{#each invites as i (i.id)}
			<li>
				<span class="status {i.used_at ? 'used' : i.expired ? 'expired' : 'active'}">{inviteStatus(i)}</span>
				<span class="meta">{tf('expires', { date: i.expires_at.slice(0, 10) })}</span>
				{#if !i.used_at && !i.expired}<button onclick={() => revoke(i.id)}>{t('revoke')}</button>{/if}
			</li>
		{/each}
	</ul>

	<h2>{t('people')}</h2>
	<table>
		<thead>
			<tr><th>{t('name')}</th><th>{t('username')}</th><th>{t('role')}</th><th></th></tr>
		</thead>
		<tbody>
			{#each users as u (u.id)}
				<tr>
					<td>{u.display_name}</td>
					<td>{u.username}</td>
					<td>{u.role === 'admin' ? t('role_admin') : t('role_user')}</td>
					<td class="actions">
						<button onclick={() => toggleRole(u)}>{u.role === 'admin' ? t('demote') : t('promote')}</button>
						<button onclick={() => resetPassword(u)}>{t('reset_password')}</button>
						{#if u.id !== $session.user?.id}
							<button class="danger" onclick={() => removeUser(u)}>{t('delete')}</button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.5rem;
	}
	th, td {
		text-align: left;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid #dee2e6;
		font-size: 0.9rem;
	}
	.actions {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.actions button {
		font-size: 0.8rem;
		padding: 0.25rem 0.5rem;
	}
	button.danger {
		background: #c92a2a;
	}
	.invites {
		list-style: none;
		padding: 0;
		margin: 0.75rem 0 1.25rem;
	}
	.invites li {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		padding: 0.3rem 0;
	}
	.status {
		font-size: 0.75rem;
		text-transform: uppercase;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
	}
	.status.active {
		background: #d3f9d8;
		color: #2b8a3e;
	}
	.status.used {
		background: #e9ecef;
		color: #495057;
	}
	.status.expired {
		background: #ffe3e3;
		color: #c92a2a;
	}
	.meta {
		color: #868e96;
		font-size: 0.8rem;
	}
	.invite code {
		word-break: break-all;
		background: #f1f3f5;
		padding: 0.2rem 0.4rem;
		border-radius: 6px;
	}
	.error {
		color: #c92a2a;
	}
</style>
