import { adminResetPasswordHandler } from '$lib/server/admin_handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function PUT(event: RequestEvent): Promise<Response> {
	return adminResetPasswordHandler(event.request, event.params.id as string);
}
