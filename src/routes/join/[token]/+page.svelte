<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { refreshSession } from '$lib/stores/session';

	let username = $state('');
	let displayName = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let busy = $state(false);

	const token = $derived(page.params.token);

	async function join() {
		errorMsg = '';
		busy = true;
		try {
			const r = await fetch('/api/join', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token, username, display_name: displayName, password })
			});
			if (!r.ok) {
				errorMsg = (await r.json()).error;
				return;
			}
			await refreshSession();
			await goto('/');
		} finally {
			busy = false;
		}
	}
</script>

<h1>Join your family's card collection</h1>
<p>You are using an invite link. Pick a login — you'll start as a regular member.</p>

<form
	onsubmit={(e) => {
		e.preventDefault();
		join();
	}}
>
	<label>Username <input bind:value={username} required minlength={3} maxlength={32} pattern="[a-z0-9_.]+" /></label>
	<label>Display name <input bind:value={displayName} required maxlength={64} /></label>
	<label>Password <input type="password" bind:value={password} required minlength={8} /></label>
	<button disabled={busy}>Join</button>
</form>

{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

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
</style>
