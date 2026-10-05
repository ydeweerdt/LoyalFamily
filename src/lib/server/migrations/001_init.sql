-- 001_init.sql — initial schema (see DESIGN.md §2)

CREATE TABLE users (
	id TEXT PRIMARY KEY,                          -- UUID
	username TEXT UNIQUE NOT NULL,               -- login handle
	display_name TEXT NOT NULL,
	password_hash TEXT NOT NULL,                 -- argon2id
	role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
	created_at TEXT NOT NULL
);

CREATE TABLE invites (
	id TEXT PRIMARY KEY,                          -- UUID
	token TEXT UNIQUE NOT NULL,                   -- random, in the join URL
	created_by TEXT NOT NULL REFERENCES users(id),
	expires_at TEXT NOT NULL,
	used_by TEXT REFERENCES users(id),            -- NULL until redeemed (single-use)
	used_at TEXT
);

CREATE TABLE cards (
	id TEXT PRIMARY KEY,                          -- UUID, client-generated
	owner_id TEXT NOT NULL REFERENCES users(id),
	brand_id TEXT,                                -- catalog id, NULL for custom/"Unknown"
	name TEXT NOT NULL,
	color TEXT NOT NULL,                          -- #rrggbb
	barcode_value TEXT NOT NULL,
	symbology TEXT NOT NULL CHECK (symbology IN
		('EAN_13','UPC_A','CODE_128','CODE_39','QR')),
	visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared')),
	comment TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,                     -- server-assigned, UTC ISO
	updated_by TEXT NOT NULL REFERENCES users(id),
	deleted_at TEXT                               -- soft delete (sync tombstone)
);

CREATE INDEX idx_cards_owner ON cards(owner_id);
CREATE INDEX idx_cards_visibility ON cards(visibility);
