<script lang="ts">
	import { onMount } from 'svelte';
	import { refreshSession, session } from '$lib/stores/session';

	let current = $state('');
	let next = $state('');
	let msg = $state('');
	let isError = $state(false);

	onMount(() => refreshSession());

	let ioMsg = $state('');
	let isErrorIo = $state(false);

	async function downloadExport() {
		const r = await fetch('/api/export', { credentials: 'same-origin' });
		if (!r.ok) {
			ioMsg = 'Export failed';
			isErrorIo = true;
			return;
		}
		const blob = await r.blob();
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'loyalfamily-export.json';
		a.click();
		URL.revokeObjectURL(a.href);
		ioMsg = 'Export downloaded.';
		isErrorIo = false;
	}

	async function importFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const text = await file.text();
		const r = await fetch('/api/import', {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'content-type': 'application/json' },
			body: text
		});
		const data = await r.json();
		if (!r.ok) {
			ioMsg = data.error;
			isErrorIo = true;
			return;
		}
		ioMsg = `Imported ${data.imported} cards${data.skipped.length ? ` (${data.skipped.length} skipped)` : ''}.`;
		isErrorIo = false;
		input.value = '';
	}

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

	<h2>Backup & migration</h2>
	<div class="row">
		<button onclick={downloadExport}>Export my cards (JSON)</button>
		<label class="file">
			Import LoyalFamily export (JSON)
			<input type="file" accept=".json,application/json" onchange={importFile} />
		</label>
	</div>
	{#if ioMsg}<p class={isErrorIo ? 'error' : 'ok'}>{ioMsg}</p>{/if}

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
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
	}
	.file {
		font-size: 0.85rem;
		color: #495057;
	}
	.error {
		color: #c92a2a;
	}
	.ok {
		color: #2b8a3e;
	}
</style>
