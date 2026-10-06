import { revokeInviteHandler } from '$lib/server/admin_handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function DELETE(event: RequestEvent): Promise<Response> {
	return revokeInviteHandler(event.request, event.params.id as string);
}
