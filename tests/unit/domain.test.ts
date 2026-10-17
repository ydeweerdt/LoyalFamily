import { describe, it, expect } from 'vitest';
import { uuid } from '$lib/domain/uuid';
import { symbologyValueError, validUuid } from '$lib/domain/validation';

describe('symbologyValueError (save-time check: the value must be encodable)', () => {
	it('accepts what the renderer can encode', () => {
		const ok: [string, string][] = [
			['4006381333931', 'EAN_13'],
			['5401234567890', 'EAN_13'], // bad check digit: warned about, never blocked (§5a)
			['590123412342', 'UPC_A'],
			['DELHAIZE-4501234567890', 'CODE_128'],
			['HELLO-123', 'CODE_39'],
			['https://example.com/c/abc', 'QR']
		];
		for (const [v, s] of ok) expect(symbologyValueError(v, s), `${v} / ${s}`).toBeUndefined();
	});

	it('rejects what would only show "Invalid value for X" when the card is opened', () => {
		expect(symbologyValueError('540123456789', 'EAN_13')).toContain('EAN_13');
		expect(symbologyValueError('54012345678901', 'EAN_13')).toContain('EAN_13');
		expect(symbologyValueError('540123456789a', 'EAN_13')).toContain('EAN_13');
		expect(symbologyValueError('5401234567890', 'UPC_A')).toContain('UPC_A');
		expect(symbologyValueError('hello-123', 'CODE_39')).toContain('CODE_39');
		expect(symbologyValueError('Héllo 123', 'CODE_128')).toContain('CODE_128');
	});
});

describe('uuid()', () => {
	it('produces valid v4 UUIDs (100 in a row)', () => {
		for (let i = 0; i < 100; i++) {
			const u = uuid();
			expect(validUuid(u)).toBe(true);
			expect(u[14]).toBe('4'); // version nibble
		}
	});

	it('fallback path (no crypto.randomUUID, e.g. plain-HTTP LAN) also yields valid v4s', () => {
		const orig = crypto.randomUUID;
		try {
			(crypto as { randomUUID?: unknown }).randomUUID = undefined;
			for (let i = 0; i < 20; i++) {
				const u = uuid();
				expect(validUuid(u)).toBe(true);
				expect(u[14]).toBe('4');
			}
		} finally {
			crypto.randomUUID = orig;
		}
	});
});
import { canDelete, canEdit, canToggleVisibility, canView, canRemoveOrDemoteAdmin } from '$lib/domain/permissions';
import { validColor, validDisplayName, validPassword, validUsername } from '$lib/domain/validation';
import type { Card, PublicUser } from '$lib/types';

const alice: PublicUser = { id: 'alice', username: 'alice', display_name: 'Alice', role: 'user' };
const admin: PublicUser = { id: 'admin', username: 'admin', display_name: 'Admin', role: 'admin' };

function card(overrides: Partial<Card> = {}): Card {
	return {
		id: 'c1',
		owner_id: 'alice',
		brand_id: 'delhaize',
		name: 'Delhaize',
		color: '#e30613',
		barcode_value: '1234567890123',
		symbology: 'EAN_13',
		visibility: 'private',
		comment: null,
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-01T00:00:00.000Z',
		updated_by: 'alice',
		deleted_at: null,
		...overrides
	};
}

describe('permissions (REQUIREMENTS §7)', () => {
	it('owner sees and manages their private card', () => {
		const c = card();
		expect(canView(alice, c)).toBe(true);
		expect(canEdit(alice, c)).toBe(true);
		expect(canDelete(alice, c)).toBe(true);
		expect(canToggleVisibility(alice, c)).toBe(true);
	});

	it("other users cannot see a private card", () => {
		expect(canView(admin, card())).toBe(false);
	});

	it('everyone sees a shared card, but only the owner edits it', () => {
		const c = card({ visibility: 'shared' });
		expect(canView(admin, c)).toBe(true);
		expect(canEdit(admin, c)).toBe(false);
		expect(canToggleVisibility(admin, c)).toBe(false);
		// admin may delete (cleanup override) — see next test
		expect(canDelete(admin, c)).toBe(true);
	});

	it('admin may delete any card (cleanup override) but never edit or toggle', () => {
		const shared = card({ visibility: 'shared' });
		expect(canDelete(admin, shared)).toBe(true);
		expect(canEdit(admin, shared)).toBe(false);
		expect(canToggleVisibility(admin, shared)).toBe(false);
	});

	it('last admin cannot be demoted or removed', () => {
		expect(canRemoveOrDemoteAdmin(1)).toBe(false);
		expect(canRemoveOrDemoteAdmin(2)).toBe(true);
	});
});

describe('validation', () => {
	it('usernames', () => {
		expect(validUsername('alice')).toBe(true);
		expect(validUsername('a.b_c1')).toBe(true);
		expect(validUsername('ab')).toBe(false);
		expect(validUsername('Alice')).toBe(false);
		expect(validUsername('a'.repeat(33))).toBe(false);
	});
	it('passwords', () => {
		expect(validPassword('12345678')).toBe(true);
		expect(validPassword('1234567')).toBe(false);
	});
	it('display names', () => {
		expect(validDisplayName('Alice A.')).toBe(true);
		expect(validDisplayName('   ')).toBe(false);
	});
	it('colors', () => {
		expect(validColor('#e30613')).toBe(true);
		expect(validColor('red')).toBe(false);
	});
});
