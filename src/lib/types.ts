export interface User {
	id: string;
	username: string;
	display_name: string;
	password_hash: string;
	role: 'admin' | 'user';
	created_at: string;
	/** Bumped whenever a session must die (password change, role change). */
	token_version: number;
}

/** User view safe to send to clients (no password hash). */
export interface PublicUser {
	id: string;
	username: string;
	display_name: string;
	role: 'admin' | 'user';
}

export interface Card {
	id: string;
	owner_id: string;
	brand_id: string | null;
	name: string;
	color: string;
	barcode_value: string;
	symbology: Symbology;
	visibility: 'private' | 'shared';
	comment: string | null;
	created_at: string;
	updated_at: string;
	updated_by: string;
	deleted_at: string | null;
}

export const SYMBOLOGIES = [
	'EAN_8',
	'EAN_13',
	'UPC_A',
	'UPC_E',
	'ITF',
	'CODABAR',
	'CODE_39',
	'CODE_93',
	'CODE_128',
	'QR',
	'AZTEC',
	'DATA_MATRIX',
	'PDF_417'
] as const;

export type Symbology = (typeof SYMBOLOGIES)[number];
