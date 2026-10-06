import { importHandler } from '$lib/server/card_handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST(event: RequestEvent): Promise<Response> {
	return importHandler(event.request);
}
