import { joinHandler } from '$lib/server/admin_handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent): Promise<Response> {
	return joinHandler(event.request);
}
