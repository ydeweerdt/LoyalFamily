import { registerHandler } from '$lib/server/handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent): Promise<Response> {
	return registerHandler(event.request);
}
