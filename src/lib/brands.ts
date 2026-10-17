import type { Card } from './types';

/**
 * Curated Belgian loyalty-brand catalog (REQUIREMENTS §4).
 * Curation for UX, not correctness — "Unknown" covers everything else.
 * Tiles render as monograms on the brand color; real SVG logos are a v2 polish item.
 * symbology_hint prioritizes the scanner decoder (added in milestone 4).
 */
export interface Brand {
	id: string;
	name: string;
	color: string;
	symbology_hint?: Card['symbology'];
}

export const BRANDS: Brand[] = [
	{ id: 'colruyt', name: 'Colruyt / Bonus', color: '#0090d9', symbology_hint: 'CODE_128' },
	{ id: 'delhaize', name: 'Delhaize', color: '#e30613', symbology_hint: 'CODE_128' },
	{ id: 'carrefour', name: 'Carrefour (Card2You)', color: '#0b3f96', symbology_hint: 'EAN_13' },
	{ id: 'albertheijn', name: 'Albert Heijn (Bonus)', color: '#df0000', symbology_hint: 'EAN_13' },
	{ id: 'lidl', name: 'Lidl Plus', color: '#1c3f94', symbology_hint: 'EAN_13' },
	{ id: 'aldi', name: 'Aldi', color: '#1c4c9c' },
	{ id: 'spar', name: 'Spar', color: '#009638' },
	{ id: 'kruidvat', name: 'Kruidvat', color: '#009639', symbology_hint: 'EAN_13' },
	{ id: 'decathlon', name: 'Decathlon', color: '#0064b5' },
	{ id: 'mediamarkt', name: 'MediaMarkt', color: '#d7141d' },
	{ id: 'ikea', name: 'IKEA Family', color: '#0051ba' },
	{ id: 'coolblue', name: 'Coolblue', color: '#0087c5' },
	{ id: 'bol', name: 'Bol', color: '#172b4d' },
	{ id: 'fnac', name: 'Fnac', color: '#111111' },
	{ id: 'dreamland', name: 'Dreamland', color: '#8b5e34' },
	{ id: 'action', name: 'Action', color: '#005baa' },
	{ id: 'hema', name: 'Hema', color: '#009a44' },
	{ id: 'primark', name: 'Primark', color: '#00a4e4' },
	{ id: 'brico', name: 'Brico', color: '#ed1c24' },
	{ id: 'bpost', name: 'Bpost', color: '#e2001a' },
	{ id: 'proximus', name: 'Proximus', color: '#00a9e0' },
	{ id: 'telenet', name: 'Telenet', color: '#00a3e0' }
];

export function getBrand(id: string): Brand | undefined {
	return BRANDS.find((b) => b.id === id);
}

/** Case-insensitive name search over the catalog. */
export function searchBrands(query: string): Brand[] {
	const q = query.trim().toLowerCase();
	const list = q
		? BRANDS.filter((b) => b.name.toLowerCase().includes(q) || b.id.includes(q))
		: BRANDS;
	return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

/** Two-letter monogram for tiles, e.g. "Colruyt / Bonus" → "CB". */
export function monogram(name: string): string {
	const words = name.split(/[\s/()]+/).filter(Boolean);
	if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
	return name.slice(0, 2).toUpperCase();
}

/**
 * Tile text color for a background: white or near-black, whichever of the two has the
 * higher contrast (WCAG relative luminance crossover is at L≈0.19). Several catalog
 * colors (light blue, orange, grey) are unreadable in white.
 */
export function inkOn(hex: string): string {
	const h = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!h) return '#ffffff';
	const lin = (i: number) => {
		const v = parseInt(h[1].slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	const l = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
	return l > 0.19 ? '#111111' : '#ffffff';
}
