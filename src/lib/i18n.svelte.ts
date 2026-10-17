/**
 * Minimal i18n: English + Dutch. Auto-detects the phone language
 * (navigator.language), overridable in Settings; choice persists in localStorage.
 */
export type Lang = 'en' | 'nl';

const LS_KEY = 'loyalfamily.lang';

const dict: Record<Lang, Record<string, string>> = {
	en: {
		// nav
		menu: 'Menu',
		sign_in: 'Sign in',
		register: 'Register',
		sign_out: 'Sign out',
		settings: 'Settings',
		admin: 'Admin',
		// home
		cards: 'Cards',
		add_card_title: 'Add card',
		search_cards: 'Search cards…',
		no_cards: 'No cards yet — tap + to add your first loyalty card.',
		offline: 'Offline — showing saved cards.',
		changes_waiting: 'change(s) waiting to sync',
		changes_failed: 'change(s) could not be saved — showing the server version',
		close: 'Close',
		save: 'Save',
		edit_card: 'Edit card',
		barcode_for: 'Barcode for',
		tile_hint_single: 'Tap for barcode · hold to edit',
		tile_hint_multi: 'Tap to view cards · hold for cards',
		delete_card: 'Delete card',
		tagline: 'Your family loyalty cards — private, self-hosted, offline-ready.',
		or: 'or',
		no_match: 'No cards match',
		// card form
		name: 'Name',
		color: 'Color',
		barcode_value: 'Barcode value',
		symbology: 'Symbology',
		shared_hint: 'Shared with the family (unchecked = private)',
		comment_hint: 'Comment (optional — distinguishes multiple cards of the same brand)',
		cancel: 'Cancel',
		scan_barcode: 'Scan barcode',
		manual: 'Manual',
		back: 'Back',
		torch: 'Torch',
		save_failed: 'Save failed',
		ean13_warn: 'This 13-digit value has an invalid EAN-13 check digit — it may be misread.',
		// add flow
		add_card: 'Add card',
		custom: 'custom',
		choose_another: 'choose another brand',
		search_brand: 'Search brand or store…',
		unknown: 'Unknown',
		no_brand_match: 'No catalog brand matches — use “Unknown” for a free-text card.',
		sign_in_to_add: 'Sign in to add cards.',
		// scanner
		requesting_camera: 'Requesting camera…',
		scanning: 'Scanning…',
		scanning_compat: 'Scanning (compatibility mode)…',
		camera_unavailable: 'Camera unavailable (permission or insecure context) — enter the value manually.',
		// barcode view
		fullscreen: 'Fullscreen',
		brightness_tip: 'Tip: raise your phone brightness and tap the fullscreen button for best scanner readability.',
		brightness_toast: 'Turn your brightness all the way up — the checkout scanner reads a brighter screen better.',
		// auth pages
		username: 'Username',
		password: 'Password',
		display_name: 'Display name',
		register_first: 'Register the first (admin) account',
		register_as_first: 'Register as first admin',
		register_hint: 'Registration is only open while the server has no users yet — the first account becomes the administrator. After that, joining requires an invite link from an admin.',
		join: 'Join',
		join_title: "Join your family's card collection",
		join_hint: "You are using an invite link. Pick a login — you'll start as a regular member.",
		sign_in_first: 'Sign in first.',
		// settings
		language: 'Language',
		lang_auto: 'Auto (phone language)',
		backup: 'Backup & migration',
		export_btn: 'Export my cards (JSON)',
		import_btn: 'Import LoyalFamily export (JSON)',
		export_failed: 'Export failed',
		export_done: 'Export downloaded.',
		imported: 'Imported {n} cards{skipped}.',
		skipped: ' ({n} skipped)',
		change_password: 'Change password',
		current_password: 'Current password',
		new_password: 'New password',
		password_changed: 'Password changed.',
		// admin
		admin_only: 'Admin only.',
		admin_load_failed: 'Failed to load admin data',
		invite_people: 'Invite people',
		create_invite: 'Create invite link',
		invite_share: 'Share this one-time link (valid 7 days):',
		no_invites: 'No invite links yet.',
		status_active: 'active',
		status_used: 'used',
		status_expired: 'expired',
		expires: 'expires {date}',
		revoke: 'Revoke',
		people: 'People',
		actions: 'Actions',
		role_admin: 'admin',
		role_user: 'user',
		promote: 'promote',
		demote: 'demote',
		reset_password: 'reset password',
		delete: 'delete',
		confirm_promote: 'Promote {name} to admin?',
		confirm_demote: 'Demote {name} to user?',
		confirm_delete: "Delete {name}? Their cards will be removed too.",
		prompt_password: 'New password for {name} (min 8 chars):'
	},
	nl: {
		// nav
		menu: 'Menu',
		sign_in: 'Aanmelden',
		register: 'Registreren',
		sign_out: 'Afmelden',
		settings: 'Instellingen',
		admin: 'Beheer',
		// home
		cards: 'Kaarten',
		add_card_title: 'Kaart toevoegen',
		search_cards: 'Kaarten zoeken…',
		no_cards: 'Nog geen kaarten — tik op + om je eerste spaarkaart toe te voegen.',
		offline: 'Offline — opgeslagen kaarten worden getoond.',
		changes_waiting: 'wijziging(en) wachten op synchronisatie',
		changes_failed: 'wijziging(en) konden niet worden opgeslagen — de serverversie wordt getoond',
		tagline: 'Jouw gezins-loyaliteitskaarten — privé, zelf gehost, offline bruikbaar.',
		or: 'of',
		no_match: 'Geen kaarten gevonden voor',
		close: 'Sluiten',
		save: 'Opslaan',
		edit_card: 'Kaart bewerken',
		barcode_for: 'Barcode van',
		tile_hint_single: 'Tik voor barcode · houd om te bewerken',
		tile_hint_multi: 'Tik om kaarten te zien · houd voor kaarten',
		delete_card: 'Kaart verwijderen',
		// card form
		name: 'Naam',
		color: 'Kleur',
		barcode_value: 'Barcode waarde',
		symbology: 'Barcode type',
		shared_hint: 'Gedeeld met het gezin (uitgevinkt = privé)',
		comment_hint: 'Opmerking (optioneel — onderscheidt meerdere kaarten van hetzelfde merk)',
		cancel: 'Annuleren',
		scan_barcode: 'Barcode scannen',
		manual: 'Manueel',
		back: 'Terug',
		torch: 'Zaklamp',
		save_failed: 'Opslaan mislukt',
		ean13_warn:
			'Deze 13-cijferige waarde heeft een onjuiste EAN-13-controlecijfer — ze kan verkeerd gelezen worden.',
		// add flow
		add_card: 'Kaart toevoegen',
		custom: 'naamloos',
		choose_another: '← ander merk kiezen',
		search_brand: 'Merk of winkel zoeken…',
		unknown: 'Onbekend',
		no_brand_match: 'Geen catalogusmerk gevonden — gebruik “Onbekend” voor een vrije tekstkaart.',
		sign_in_to_add: 'Meld je aan om kaarten toe te voegen.',
		// scanner
		requesting_camera: 'Camera wordt aangevraagd…',
		scanning: 'Scannen…',
		scanning_compat: 'Scannen (compatibiliteitsmodus)…',
		camera_unavailable:
			'Camera niet beschikbaar (toestemming of onbeveiligde context) — voer de waarde manueel in.',
		// barcode view
		fullscreen: 'Volledig scherm',
		brightness_tip: 'Tip: verhoog de helderheid van je telefoon en tik op de volledig-schermknop voor de beste scanbaarheid.',
		brightness_toast: 'Zet je helderheid volledig open — de kassascanner leest een helderder scherm beter.',
		// auth pages
		username: 'Gebruikersnaam',
		password: 'Wachtwoord',
		display_name: 'Weergavenaam',
		register_first: 'Registreer het eerste (beheer)account',
		register_as_first: 'Registreren als eerste beheerder',
		register_hint: 'Registratie is alleen open zolang de server nog geen gebruikers heeft — het eerste account wordt de beheerder. Daarna deelnemen kan alleen via een uitnodigingslink van een beheerder.',
		join: 'Deelnemen',
		join_title: 'Doe mee met de kaarten van je gezin',
		join_hint: 'Je gebruikt een uitnodigingslink. Kies een login — je start als gewoon lid.',
		sign_in_first: 'Meld je eerst aan.',
		// settings
		language: 'Taal',
		lang_auto: 'Auto (taal van telefoon)',
		backup: 'Back-up & migratie',
		export_btn: 'Mijn kaarten exporteren (JSON)',
		import_btn: 'LoyalFamily-export importeren',
		export_failed: 'Exporteren mislukt',
		export_done: 'Export gedownload.',
		imported: '{n} kaarten geïmporteerd{skipped}.',
		skipped: ' ({n} overgeslagen)',
		change_password: 'Wachtwoord wijzigen',
		current_password: 'Huidig wachtwoord',
		new_password: 'Nieuw wachtwoord',
		password_changed: 'Wachtwoord gewijzigd.',
		// admin
		admin_only: 'Alleen voor beheerders.',
		admin_load_failed: 'Beheergegevens konden niet geladen worden',
		invite_people: 'Nodig mensen uit',
		create_invite: 'Uitnodigingslink maken',
		invite_share: 'Deel deze eenmalige link (7 dagen geldig):',
		no_invites: 'Nog geen uitnodigingslinks.',
		status_active: 'actief',
		status_used: 'gebruikt',
		status_expired: 'verlopen',
		expires: 'verloopt op {date}',
		revoke: 'Intrekken',
		people: 'Mensen',
		actions: 'Acties',
		role_admin: 'beheerder',
		role_user: 'lid',
		promote: 'bevorderen',
		demote: 'degraderen',
		reset_password: 'wachtwoord resetten',
		delete: 'verwijderen',
		confirm_promote: '{name} bevorderen tot beheerder?',
		confirm_demote: '{name} degraderen tot lid?',
		confirm_delete: '{name} verwijderen? Zijn kaarten worden ook verwijderd.',
		prompt_password: 'Nieuw wachtwoord voor {name} (min 8 tekens):'
	}
};

/** Pure language choice: explicit setting wins, then nl*, else en. */
export function pickLang(stored: string | null, browserLang: string): Lang {
	if (stored === 'nl' || stored === 'en') return stored;
	return (browserLang || '').toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

let lang = $state<Lang>('en');

function applyLang(next: Lang): void {
	lang = next;
	if (typeof document !== 'undefined') document.documentElement.lang = next;
}

export function initLang(): void {
	let stored: string | null = null;
	try {
		stored = localStorage.getItem(LS_KEY);
	} catch {
		/* storage unavailable (private mode) — stay with browser detection */
	}
	applyLang(pickLang(stored, typeof navigator !== 'undefined' ? navigator.language : 'en'));
}

export function setLang(next: Lang | 'auto'): void {
	try {
		if (next === 'auto') localStorage.removeItem(LS_KEY);
		else localStorage.setItem(LS_KEY, next);
	} catch {
		/* ignore */
	}
	applyLang(pickLang(next === 'auto' ? null : next, typeof navigator !== 'undefined' ? navigator.language : 'en'));
}

export function currentLang(): Lang {
	return lang;
}

/** Current Settings choice ('auto' when following the phone language). */
export function langSetting(): 'auto' | Lang {
	try {
		const v = localStorage.getItem(LS_KEY);
		return v === 'nl' || v === 'en' ? v : 'auto';
	} catch {
		return 'auto';
	}
}

export function t(key: string): string {
	return dict[lang][key] || dict.en[key] || key;
}

/** t() with {placeholder} substitution. */
export function tf(key: string, vars: Record<string, string | number>): string {
	let s = t(key);
	for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
	return s;
}
