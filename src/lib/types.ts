export interface User {
	id: string;
	username: string;
	display_name: string;
	password_hash: string;
	role: 'admin' | 'user';
	created_at: string;
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
	symbology: 'EAN_13' | 'UPC_A' | 'CODE_128' | 'CODE_39' | 'QR';
	visibility: 'private' | 'shared';
	comment: string | null;
	created_at: string;
	updated_at: string;
	updated_by: string;
	deleted_at: string | null;
}

export const SYMBOLOGIES = ['EAN_13', 'UPC_A', 'CODE_128', 'CODE_39', 'QR'] as const;
