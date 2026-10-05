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
