import crypto from 'node:crypto';

const SESSION_COOKIE = 'session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function secret(): string {
	const s = process.env.COOKIE_SECRET;
	if (!s || s.length < 32) {
		throw new Error('COOKIE_SECRET must be set to a random string of >= 32 characters');
	}
	return s;
}

export function createSessionToken(userId: string): string {
	const payload = Buffer.from(
		JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS })
	).toString('base64url');
	const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
	return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
	const [payload, sig] = token.split('.');
	if (!payload || !sig) return null;
	const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
	const a = Buffer.from(sig);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
	try {
		const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
		if (typeof data.uid !== 'string' || typeof data.exp !== 'number' || data.exp < Date.now()) {
			return null;
		}
		return data.uid;
	} catch {
		return null;
	}
}

/** Cookies are Secure only when the app is actually served over HTTPS (PUBLIC_URL). */
function secureCookies(): boolean {
	return (process.env.PUBLIC_URL ?? '').startsWith('https');
}

export function sessionCookieHeader(token: string): string {
	const parts = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
	if (secureCookies()) parts.push('Secure');
	parts.push(`Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
	return parts.join('; ');
}

export function clearSessionCookieHeader(): string {
	const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
	if (secureCookies()) parts.push('Secure');
	return parts.join('; ');
}

export function readSessionToken(request: Request): string | null {
	const cookie = request.headers.get('cookie');
	if (!cookie) return null;
	for (const part of cookie.split(';')) {
		const [name, ...rest] = part.trim().split('=');
		if (name === SESSION_COOKIE) return rest.join('=');
	}
	return null;
}
