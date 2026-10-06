import { createInviteHandler, invitesListHandler } from '$lib/server/admin_handlers';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent): Promise<Response> {
	return invitesListHandler(event.request);
}

export async function POST(event: RequestEvent): Promise<Response> {
	return createInviteHandler(event.request);
}
