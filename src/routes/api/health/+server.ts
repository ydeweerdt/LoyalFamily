import { json } from '$lib/server/api';

export function GET(): Response {
	return json({ status: 'ok' });
}
