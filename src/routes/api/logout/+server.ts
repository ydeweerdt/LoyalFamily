import { json } from '$lib/server/api';
import { clearSessionCookieHeader } from '$lib/server/sessions';

export async function POST(): Promise<Response> {
	return json({ ok: true }, 200, { 'set-cookie': clearSessionCookieHeader() });
}
