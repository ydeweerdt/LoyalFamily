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
	<label>{t('username')} <input name="username" bind:value={username} required minlength={3} maxlength={32} pattern="[a-z0-9_.]+" /></label>
	<label>{t('display_name')} <input name="display_name" bind:value={displayName} required maxlength={64} /></label>
	<label>{t('password')} <input name="password" type="password" bind:value={password} required minlength={8} /></label>
	<button disabled={busy}>{t('join')}</button>
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
