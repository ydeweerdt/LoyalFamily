<script lang="ts">
	import { onMount } from 'svelte';
	import { refreshSession, session } from '$lib/stores/session';

	let current = $state('');
	let next = $state('');
	let msg = $state('');
	let isError = $state(false);

	onMount(() => refreshSession());

	async function change() {
		msg = '';
		isError = false;
		const r = await fetch('/api/me/password', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ current_password: current, new_password: next })
		});
		const data = await r.json();
		if (!r.ok) {
			msg = data.error;
			isError = true;
			return;
		}
		msg = 'Password changed.';
		current = '';
		next = '';
	}
</script>

{#if !$session.user}
	<p><a href="/login">Sign in</a> first.</p>
{:else}
	<h1>Settings</h1>

	<h2>Change password</h2>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			change();
		}}
	>
		<label>Current password <input type="password" bind:value={current} required /></label>
		<label>New password <input type="password" bind:value={next} required minlength={8} /></label>
		<button>Change password</button>
	</form>
	{#if msg}<p class={isError ? 'error' : 'ok'}>{msg}</p>{/if}
{/if}

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		max-width: 340px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.error {
		color: #c92a2a;
	}
	.ok {
		color: #2b8a3e;
	}
</style>
