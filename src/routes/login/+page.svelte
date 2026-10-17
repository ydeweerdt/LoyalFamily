<script lang="ts">
	import { goto } from '$app/navigation';
	import { refreshSession } from '$lib/stores/session';
	import { t } from '$lib/i18n.svelte';

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
			await goto('/');
		} else {
			errorMsg = (await r.json()).error ?? 'Login failed';
		}
		busy = false;
	}
</script>

<h1>{t('sign_in')}</h1>
<form onsubmit={submit}>
	<label class="field-label">
		{t('username')}
		<input class="field" name="username" bind:value={username} autocomplete="username" required />
	</label>
	<label class="field-label">
		{t('password')}
		<input class="field" name="password" type="password" bind:value={password} autocomplete="current-password" required />
	</label>
	<button class="btn btn-primary" disabled={busy}>{t('sign_in')}</button>
</form>
{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

