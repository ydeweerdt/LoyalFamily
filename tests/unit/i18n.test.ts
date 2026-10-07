import { describe, expect, it } from 'vitest';
import { pickLang, t, tf } from '../../src/lib/i18n.svelte';

describe('pickLang', () => {
	it('explicit setting wins over the browser language', () => {
		expect(pickLang('nl', 'en-US')).toBe('nl');
		expect(pickLang('en', 'nl-BE')).toBe('en');
	});
	it('auto: nl* browser languages map to nl', () => {
		expect(pickLang(null, 'nl')).toBe('nl');
		expect(pickLang(null, 'nl-BE')).toBe('nl');
		expect(pickLang(null, 'NL')).toBe('nl');
	});
	it('auto: everything else falls back to en', () => {
		expect(pickLang(null, 'en-GB')).toBe('en');
		expect(pickLang(null, 'fr-FR')).toBe('en');
		expect(pickLang(null, '')).toBe('en');
		expect(pickLang('garbage', 'de-DE')).toBe('en');
	});
	it('t falls back to the key, tf substitutes {placeholders}', () => {
		expect(t('nope')).toBe('nope');
		expect(tf('expires', { date: '2026-01-01' })).toBe('expires 2026-01-01');
		expect(tf('imported', { n: 3, skipped: '' })).toBe('Imported 3 cards.');
	});
});
