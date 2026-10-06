import { deleteCardHandler, updateCardHandler } from '$lib/server/card_handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function PUT(event: RequestEvent): Promise<Response> {
	return updateCardHandler(event.request, event.params.id as string);
}

export async function DELETE(event: RequestEvent): Promise<Response> {
	return deleteCardHandler(event.request, event.params.id as string);
}
