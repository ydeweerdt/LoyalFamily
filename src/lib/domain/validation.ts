/** Pure input validation rules. */

export function validUsername(u: unknown): u is string {
	return typeof u === 'string' && /^[a-z0-9_.]{3,32}$/.test(u);
}

export function validDisplayName(d: unknown): d is string {
	return typeof d === 'string' && d.trim().length >= 1 && d.trim().length <= 64;
}

export function validPassword(p: unknown): p is string {
	return typeof p === 'string' && p.length >= 8 && p.length <= 200;
}

export function validColor(c: unknown): c is string {
	return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
}

export function validUuid(s: unknown): s is string {
	return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function validSymbology(s: unknown, allowed: readonly string[]): s is string {
	return typeof s === 'string' && allowed.includes(s);
}

export function validBarcodeValue(v: unknown): v is string {
	return typeof v === 'string' && v.length >= 1 && v.length <= 512 && !/[\u0000-\u001f]/.test(v);
}

export function validComment(c: unknown): c is string {
	return typeof c === 'string' && c.length <= 200;
}

export function validVisibility(v: unknown): v is 'private' | 'shared' {
	return v === 'private' || v === 'shared';
}
