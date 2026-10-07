<script lang="ts">
	import { refreshSession } from '$lib/stores/session';
	import { t } from '$lib/i18n.svelte';

	let username = $state('');
	let displayName = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let info = $state('');
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		errorMsg = '';
		const r = await fetch('/api/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ username, display_name: displayName, password }),
			credentials: 'same-origin'
		});
		if (r.ok) {
			await refreshSession();
			location.href = '/';
		} else {
			errorMsg = (await r.json()).error ?? 'Registration failed';
		}
		busy = false;
	}
</script>

<h1>{t('register')}</h1>
<p class="hint">{t('register_hint')}</p>
<form onsubmit={submit}>
	<label>
		{t('username')}
		<input name="username" bind:value={username} autocomplete="username" required />
	</label>
	<label>
		{t('display_name')}
		<input name="display_name" bind:value={displayName} autocomplete="name" required />
	</label>
	<label>
		{t('password')}
		<input name="password" type="password" bind:value={password} autocomplete="new-password" required />
	</label>
	<button disabled={busy}>{t('register_as_first')}</button>
</form>
{#if errorMsg}<p class="error">{errorMsg}</p>{/if}
{#if info}<p>{info}</p>{/if}

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
	.hint {
		color: #666;
	}
</style>
