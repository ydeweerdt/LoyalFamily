<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { refreshSession } from '$lib/stores/session';
	import { t } from '$lib/i18n.svelte';

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

<h1>{t('join_title')}</h1>
<p>{t('join_hint')}</p>

<form
	onsubmit={(e) => {
		e.preventDefault();
		join();
	}}
>
	<label class="field-label">{t('username')} <input class="field" name="username" bind:value={username} required minlength={3} maxlength={32} pattern="[a-z0-9_.]+" autocomplete="username" /></label>
	<label class="field-label">{t('display_name')} <input class="field" name="display_name" bind:value={displayName} required maxlength={64} autocomplete="name" /></label>
	<label class="field-label">{t('password')} <input class="field" name="password" type="password" bind:value={password} required minlength={8} autocomplete="new-password" /></label>
	<button class="btn btn-primary" disabled={busy}>{t('join')}</button>
</form>

{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

<style>
	form {
		max-width: 340px;
	}
</style>
