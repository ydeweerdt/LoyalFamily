/**
 * Card CRUD handlers — plain (Request, params) => Response, permission rules
 * enforced server-side via the pure domain layer (REQUIREMENTS §7).
 */
import { error, json, parseJsonBody, requireUser } from './api';
import { getBrand } from '$lib/brands';
import { canDelete, canEdit } from '$lib/domain/permissions';
import {
	validBarcodeValue,
	validColor,
	validComment,
	validDisplayName,
	validSymbology,
	validUuid,
	validVisibility
} from '$lib/domain/validation';
import { getCard, insertCard, listOwnedCards, listVisibleCards, softDeleteCard, updateCard, SYMBOLOGIES } from './cards';
import type { CardPatch } from './cards';
import { EXPORT_FORMAT, ParseError, parseExport } from '$lib/domain/import';

export function cardsListHandler(request: Request): Response {
	const { user, unauthorized } = requireUser(request);
	if (unauthorized) return unauthorized;
	return json({ cards: listVisibleCards(user.id) });
}

export async function createCardHandler(request: Request): Promise<Response> {
	const { user, unauthorized } = requireUser(request);
	if (unauthorized) return unauthorized;

	const body = await parseJsonBody(request);
	if (!body) return error('invalid request body', 400);

	const { id, brand_id, name, color, barcode_value, symbology, visibility, comment } = body;

	if (!validUuid(id)) return error('id must be a client-generated UUID', 400);
	if (getCard(id)) return error('card id already exists', 409);
	if (!validDisplayName(name)) return error('name is required (1-64 chars)', 400);
	if (!validColor(color)) return error('color must be #rrggbb', 400);
	if (!validBarcodeValue(barcode_value)) return error('barcode value is required (1-512 printable chars)', 400);
	if (!validSymbology(symbology, SYMBOLOGIES)) return error(`symbology must be one of ${SYMBOLOGIES.join(', ')}`, 400);
	if (!validVisibility(visibility)) return error("visibility must be 'private' or 'shared'", 400);
	if (comment !== undefined && comment !== null && !validComment(comment)) return error('comment max 200 chars', 400);
	if (brand_id != null && typeof brand_id !== 'string') return error('brand_id must be a string or null', 400);
	if (brand_id != null && !getBrand(brand_id)) return error('unknown brand_id', 400);

	const card = insertCard({
		id,
		owner_id: user.id,
		brand_id: brand_id as string | null,
		name: String(name).trim(),
		color,
		barcode_value,
		symbology,
		visibility,
		comment: comment == null ? null : String(comment)
	});
	return json(card, 201);
}

export async function updateCardHandler(request: Request, id: string): Promise<Response> {
	const { user, unauthorized } = requireUser(request);
	if (unauthorized) return unauthorized;

	const card = getCard(id);
	if (!card) return error('not found', 404);
	// owner-only editing — not even the admin (REQUIREMENTS §7)
	if (!canEdit(user, card)) return error('only the owner can edit this card', 403);

	const body = await parseJsonBody(request);
	if (!body) return error('invalid request body', 400);

	const patch: CardPatch = {};
	if (body.name !== undefined) {
		if (!validDisplayName(body.name)) return error('name must be 1-64 chars', 400);
		patch.name = String(body.name).trim();
	}
	if (body.color !== undefined) {
		if (!validColor(body.color)) return error('color must be #rrggbb', 400);
		patch.color = body.color;
	}
	if (body.barcode_value !== undefined) {
		if (!validBarcodeValue(body.barcode_value)) return error('barcode value must be 1-512 printable chars', 400);
		patch.barcode_value = body.barcode_value;
	}
	if (body.symbology !== undefined) {
		if (!validSymbology(body.symbology, SYMBOLOGIES)) return error(`symbology must be one of ${SYMBOLOGIES.join(', ')}`, 400);
		patch.symbology = body.symbology;
	}
	if (body.visibility !== undefined) {
		if (!validVisibility(body.visibility)) return error("visibility must be 'private' or 'shared'", 400);
		patch.visibility = body.visibility; // toggling allowed: caller is the owner (canEdit passed)
	}
	if (body.comment !== undefined) {
		if (body.comment !== null && !validComment(body.comment)) return error('comment max 200 chars', 400);
		patch.comment = body.comment === null ? null : String(body.comment);
	}
	if (Object.keys(patch).length === 0) return error('no fields to update', 400);

	// last-write-wins: no optimistic locking (DESIGN §4)
	return json(updateCard(id, patch, user.id));
}

export function deleteCardHandler(request: Request, id: string): Response {
	const { user, unauthorized } = requireUser(request);
	if (unauthorized) return unauthorized;

	const card = getCard(id);
	if (!card) return error('not found', 404);
	// owner, or admin cleanup override (REQUIREMENTS §7)
	if (!canDelete(user, card)) return error('only the owner or an admin can delete this card', 403);

	softDeleteCard(id);
	return json({ ok: true });
}

/* ---------- export / import (REQUIREMENTS §8) ---------- */

export function exportHandler(request: Request): Response {
	const { user, unauthorized } = requireUser(request);
	if (unauthorized) return unauthorized;
	const cards = listOwnedCards(user.id).map((c) => ({
		id: c.id,
		brand_id: c.brand_id,
		name: c.name,
		color: c.color,
		barcode_value: c.barcode_value,
		symbology: c.symbology,
		visibility: c.visibility,
		comment: c.comment
	}));
	return json(
		{ format: EXPORT_FORMAT, exported_at: new Date().toISOString(), cards },
		200,
		{ 'content-disposition': 'attachment; filename="loyalfamily-export.json"' }
	);
}

export async function importHandler(request: Request): Promise<Response> {
	const { user, unauthorized } = requireUser(request);
	if (unauthorized) return unauthorized;

	const raw = await request.text();
	let result;
	try {
		// accept either the JSON document itself or it wrapped as a string body
		let text = raw;
		try {
			const parsed = JSON.parse(raw);
			if (typeof parsed === 'string') text = parsed;
		} catch {
			/* not JSON at all → let parseExport report it */
		}
		result = parseExport(text);
	} catch (e) {
		if (e instanceof ParseError) return error(e.message, 400);
		throw e;
	}
	if (result.cards.length === 0) {
		return error(result.skipped.length ? 'no importable cards in file' : 'file contains no cards', 400);
	}

	let imported = 0;
	for (const c of result.cards) {
		let id = c.id;
		if (getCard(id)) id = crypto.randomUUID(); // collision with existing card → fresh id, never abort
		insertCard({
			id,
			owner_id: user.id, // imported cards belong to the importer
			brand_id: c.brand_id,
			name: c.name,
			color: c.color,
			barcode_value: c.barcode_value,
			symbology: c.symbology,
			visibility: c.visibility,
			comment: c.comment
		});
		imported++;
	}
	return json({ imported, skipped: result.skipped, source: result.source }, 200);
}
