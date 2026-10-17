<script lang="ts">
	import { goto } from '$app/navigation';
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
			await goto('/');
		} else {
			errorMsg = (await r.json()).error ?? 'Registration failed';
		}
		busy = false;
	}
</script>

<h1>{t('register')}</h1>
<p class="meta">{t('register_hint')}</p>
<form onsubmit={submit}>
	<label class="field-label">
		{t('username')}
		<input class="field" name="username" bind:value={username} autocomplete="username" required />
	</label>
	<label class="field-label">
		{t('display_name')}
		<input class="field" name="display_name" bind:value={displayName} autocomplete="name" required />
	</label>
	<label class="field-label">
		{t('password')}
		<input class="field" name="password" type="password" bind:value={password} autocomplete="new-password" required />
	</label>
	<button class="btn btn-primary" disabled={busy}>{t('register_as_first')}</button>
</form>
{#if errorMsg}<p class="error">{errorMsg}</p>{/if}
{#if info}<p>{info}</p>{/if}
