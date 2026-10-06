<script lang="ts">
	import { onMount } from 'svelte';
	import { refreshSession, session } from '$lib/stores/session';
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
			errorMsg = 'Failed to load admin data';
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
		if (!confirm(`${role === 'admin' ? 'Promote' : 'Demote'} ${u.display_name} to ${role}?`)) return;
		if (await api(`/api/admin/users/${u.id}`, 'PUT', { role })) await load();
	}

	async function resetPassword(u: PublicUser) {
		const password = prompt(`New password for ${u.display_name} (min 8 chars):`);
		if (!password) return;
		if (await api(`/api/admin/users/${u.id}/password`, 'PUT', { password })) await load();
	}

	async function removeUser(u: PublicUser) {
		if (!confirm(`Delete ${u.display_name}? Their cards will be removed too.`)) return;
		if (await api(`/api/admin/users/${u.id}`, 'DELETE')) await load();
	}

	function inviteStatus(i: InviteRow): string {
		return i.used_at ? 'used' : i.expired ? 'expired' : 'active';
	}
</script>

{#if !$session.user}
	<p><a href="/login">Sign in</a> first.</p>
{:else if !isAdmin}
	<p>Admin only.</p>
{:else}
	<h1>Admin</h1>

	{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

	<h2>Invite people</h2>
	<button onclick={createInvite}>Create invite link</button>
	{#if newInviteUrl}
		<p class="invite">Share this one-time link (valid 7 days):<br />
			<code>{newInviteUrl}</code></p>
	{/if}
	<ul class="invites">
		{#each invites as i (i.id)}
			<li>
				<span class="status {inviteStatus(i)}">{inviteStatus(i)}</span>
				<span class="meta">expires {i.expires_at.slice(0, 10)}</span>
				{#if !i.used_at && !i.expired}<button onclick={() => revoke(i.id)}>Revoke</button>{/if}
			</li>
		{/each}
	</ul>

	<h2>People</h2>
	<table>
		<thead>
			<tr><th>Name</th><th>Username</th><th>Role</th><th></th></tr>
		</thead>
		<tbody>
			{#each users as u (u.id)}
				<tr>
					<td>{u.display_name}</td>
					<td>{u.username}</td>
					<td>{u.role}</td>
					<td class="actions">
						<button onclick={() => toggleRole(u)}>{u.role === 'admin' ? 'demote' : 'promote'}</button>
						<button onclick={() => resetPassword(u)}>reset password</button>
						{#if u.id !== $session.user?.id}
							<button class="danger" onclick={() => removeUser(u)}>delete</button>
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
