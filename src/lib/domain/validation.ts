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

/** EAN-13 modulo-10 check digit (used to hint/pre-validate scanned values). */
export function validEan13Checksum(v: string): boolean {
	if (!/^\d{13}$/.test(v)) return false;
	let sum = 0;
	for (let i = 0; i < 12; i++) sum += +v[i] * (i % 2 === 0 ? 1 : 3);
	return (10 - (sum % 10)) % 10 === +v[12];
}
