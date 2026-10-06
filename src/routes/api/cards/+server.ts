import { createCardHandler, cardsListHandler } from '$lib/server/card_handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent): Promise<Response> {
	return cardsListHandler(event.request);
}

export async function POST(event: RequestEvent): Promise<Response> {
	return createCardHandler(event.request);
}
