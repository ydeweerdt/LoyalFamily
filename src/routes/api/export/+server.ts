import { exportHandler } from '$lib/server/card_handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent): Promise<Response> {
	return exportHandler(event.request);
}
