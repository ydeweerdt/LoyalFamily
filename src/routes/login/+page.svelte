<script lang="ts">
	import { refreshSession } from '$lib/stores/session';

	let username = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		errorMsg = '';
		const r = await fetch('/api/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ username, password }),
			credentials: 'same-origin'
		});
		if (r.ok) {
			await refreshSession();
			location.href = '/';
		} else {
			errorMsg = (await r.json()).error ?? 'Login failed';
		}
		busy = false;
	}
</script>

<h1>Sign in</h1>
<form onsubmit={submit}>
	<label>
		Username
		<input name="username" bind:value={username} autocomplete="username" required />
	</label>
	<label>
		Password
		<input name="password" type="password" bind:value={password} autocomplete="current-password" required />
	</label>
	<button disabled={busy}>Sign in</button>
</form>
{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

<style>
	label {
		display: block;
		margin: 0.5rem 0;
	}
	input {
		display: block;
		width: 100%;
		padding: 0.4rem;
	}
	.error {
		color: #c92a2a;
	}
</style>
