-- 003_symbologies.sql — the detection set equals the render set (REQUIREMENTS §5),
-- so the CHECK must accept every symbology the scanner can report.
-- SQLite cannot ALTER a CHECK constraint: rebuild the table in place.
CREATE TABLE cards_v3 (
	id TEXT PRIMARY KEY,
	owner_id TEXT NOT NULL REFERENCES users(id),
	brand_id TEXT,
	name TEXT NOT NULL,
	color TEXT NOT NULL,
	barcode_value TEXT NOT NULL,
	symbology TEXT NOT NULL CHECK (symbology IN
		('EAN_8','EAN_13','UPC_A','UPC_E','ITF','CODABAR','CODE_39','CODE_93','CODE_128',
		 'QR','AZTEC','DATA_MATRIX','PDF_417')),
	visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared')),
	comment TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	updated_by TEXT NOT NULL REFERENCES users(id),
	deleted_at TEXT
);

INSERT INTO cards_v3
	SELECT id, owner_id, brand_id, name, color, barcode_value, symbology, visibility,
		comment, created_at, updated_at, updated_by, deleted_at
	FROM cards;

DROP TABLE cards;
ALTER TABLE cards_v3 RENAME TO cards;

CREATE INDEX idx_cards_owner ON cards(owner_id);
CREATE INDEX idx_cards_visibility ON cards(visibility);
