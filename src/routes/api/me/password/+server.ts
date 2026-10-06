import { changePasswordHandler } from '$lib/server/admin_handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function PUT(event: RequestEvent): Promise<Response> {
	return changePasswordHandler(event.request);
}
