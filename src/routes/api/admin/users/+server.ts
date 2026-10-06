import { usersListHandler } from '$lib/server/admin_handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent): Promise<Response> {
	return usersListHandler(event.request);
}
