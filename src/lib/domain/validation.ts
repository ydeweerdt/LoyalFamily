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

/**
 * Can this value be encoded at all in this symbology? Mirrors the renderer's rules
 * (JsBarcode EAN13/UPC/CODE39/CODE128) so a card that would only show "Invalid value
 * for X" later is rejected when it is saved. Checksums are NOT checked here — they are
 * warned about, never blocked (REQUIREMENTS §5a).
 */
export function symbologyValueError(value: string, symbology: string): string | undefined {
	switch (symbology) {
		case 'EAN_13':
			return /^\d{13}$/.test(value) ? undefined : 'EAN_13 needs exactly 13 digits (12-digit codes are UPC_A)';
		case 'UPC_A':
			return /^\d{12}$/.test(value) ? undefined : 'UPC_A needs exactly 12 digits';
		case 'CODE_39':
			return /^[0-9A-Z.$/+% -]+$/.test(value)
				? undefined
				: 'CODE_39 only supports 0-9, uppercase A-Z and - . $ / + % space';
		case 'CODE_128':
			return !/[^\x20-\x7e]/.test(value) ? undefined : 'CODE_128 only supports printable ASCII characters';
		default:
			return undefined; // QR: any printable text
	}
}

/** EAN-13 modulo-10 check digit (used to hint/pre-validate scanned values). */
export function validEan13Checksum(v: string): boolean {
	if (!/^\d{13}$/.test(v)) return false;
	let sum = 0;
	for (let i = 0; i < 12; i++) sum += +v[i] * (i % 2 === 0 ? 1 : 3);
	return (10 - (sum % 10)) % 10 === +v[12];
}
