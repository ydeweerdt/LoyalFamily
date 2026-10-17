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
	{ id: 'telenet', name: 'Telenet', color: '#00a3e0' },
	// fashion, drugstore and specialty chains (user-supplied list; Kruidvat,
	// Decathlon, Carrefour and Hema were already in the catalog)
	{ id: 'asadventure', name: 'A.S. Adventure', color: '#1c5c3c' },
	{ id: 'gamma', name: 'GAMMA', color: '#004b8d' },
	{ id: 'ca', name: 'C&A', color: '#123a6b' },
	{ id: 'zara', name: 'Zara', color: '#1a1a1a' },
	{ id: 'douglas', name: 'Douglas', color: '#2b2b2b' },
	{ id: 'flyingtiger', name: 'Flying Tiger', color: '#ffb400' },
	{ id: 'etam', name: 'Etam', color: '#e5007d' },
	{ id: 'hm', name: 'H&M', color: '#c8102e' },
	{ id: 'hansanders', name: 'Hans Anders', color: '#0057b8' },
	{ id: 'hollandbarrett', name: 'Holland & Barrett', color: '#2e7d32' },
	{ id: 'iciparisxl', name: 'Ici Paris XL', color: '#e2007a' },
	{ id: 'hunkemoller', name: 'Hunkemöller', color: '#8f1d21' },
	{ id: 'inno', name: 'INNO', color: '#d50032' },
	{ id: 'jbc', name: 'JBC', color: '#cc0000' },
	{ id: 'jackandjones', name: 'Jack & Jones', color: '#213a5c' },
	{ id: 'msmode', name: 'MS Mode', color: '#2f2f2f' },
	{ id: 'oilandvinegar', name: 'Oil & Vinegar', color: '#3f5d28' },
	{ id: 'okaidi', name: 'Okaïdi', color: '#0099a8' },
	{ id: 'only', name: 'ONLY', color: '#1f1f1f' },
	{ id: 'onlyandsons', name: 'ONLY & Sons', color: '#2c3e50' },
	{ id: 'pearle', name: 'Pearle', color: '#0072ce' },
	{ id: 'pipoos', name: 'Pipoos', color: '#f07f00' },
	{ id: 'rituals', name: 'Rituals', color: '#5b2c4d' },
	{ id: 'riverwoods', name: 'River Woods', color: '#1f3a5f' },
	{ id: 'standaard', name: 'Standaard Boekhandel', color: '#005a9c' },
	{ id: 'torfs', name: 'Torfs', color: '#d52b1e' },
	{ id: 'vandenborre', name: 'Vanden Borre', color: '#cc2200' },
	{ id: 'yvesrocher', name: 'Yves Rocher', color: '#00693c' },
	{ id: 'veritas', name: 'Veritas', color: '#b3001b' },
	{ id: 'hetvershuisje', name: 'Het Vershuisje', color: '#2e8b57' },
	{ id: 'aveve', name: 'Aveve', color: '#007a3d' },
	{ id: 'vaneycksport', name: 'Van Eyck Sport', color: '#003c7b' },
	{ id: 'unitedbrands', name: 'United Brands', color: '#1f2a44' },
	{ id: 'bodyshop', name: 'The Body Shop', color: '#005c38' },
	{ id: 'soliver', name: 's.Oliver', color: '#263238' },
	{ id: 'produo', name: 'Pro-Duo', color: '#3a3a3a' },
	{ id: 'paradisio', name: 'Paradisio', color: '#c2185b' },
	{ id: 'modemakers', name: 'Modemakers', color: '#222222' },
	{ id: 'levis', name: "Levi's", color: '#234a7d' },
	{ id: 'kiabi', name: 'Kiabi', color: '#0f4c81' },
	{ id: 'iu', name: 'iU', color: '#101820' },
	{ id: 'guysnaaicentrum', name: "Guy's Naaicentrum", color: '#34495e' },
	{ id: 'foka', name: 'Foka', color: '#404040' },
	{ id: 'euroshop', name: 'Euroshop', color: '#004e8f' },
	{ id: 'di', name: 'di!', color: '#f26522' },
	{ id: 'desigual', name: 'Desigual', color: '#ef6c00' },
	{ id: 'devleeshoeve', name: 'De Vleeshoeve', color: '#8b1a1a' },
	{ id: 'damart', name: 'Damart', color: '#a4123f' },
	{ id: 'cfe', name: 'CFE', color: '#4a5568' },
	{ id: 'belbo', name: 'Bel&Bo', color: '#3b3b3b' },
	{ id: 'apothekerswaasland', name: 'Apothekers Waasland', color: '#1b7f4b' }
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
	const words = name.split(/[\s/()&.]+/).filter(Boolean);
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
