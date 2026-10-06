import { deleteUserHandler, setRoleHandler } from '$lib/server/admin_handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function PUT(event: RequestEvent): Promise<Response> {
	return setRoleHandler(event.request, event.params.id as string);
}

export async function DELETE(event: RequestEvent): Promise<Response> {
	return deleteUserHandler(event.request, event.params.id as string);
}
