import { meHandler } from '$lib/server/handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent): Promise<Response> {
	return meHandler(event.request);
}
