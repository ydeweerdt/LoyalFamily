/**
 * Break-glass for the case REQUIREMENTS §7 cannot solve self-service: the last
 * admin loses their password, there is no email recovery and the last admin
 * cannot be removed — without this the instance is permanently locked.
 *
 * Setting RESET_ADMIN=<username> + RESET_ADMIN_PASSWORD=<new> in the container
 * environment resets that user's password once at startup (and revokes their
 * existing sessions). Remove both variables afterwards: while they are set,
 * every container start repeats the reset.
 */
import { findByUsername, hashPasswordSync, setPasswordHash } from './users';
import { validPassword } from '$lib/domain/validation';

export function applyAdminReset(): void {
	const username = process.env.RESET_ADMIN;
	const password = process.env.RESET_ADMIN_PASSWORD;
	if (!username || !password) return;

	const user = findByUsername(username);
	if (!user) {
		console.error(`RESET_ADMIN='${username}': no such user, nothing was reset`);
		return;
	}
	if (!validPassword(password)) {
		console.error('RESET_ADMIN_PASSWORD does not meet the password rules (8+ chars), nothing was reset');
		return;
	}
	setPasswordHash(user.id, hashPasswordSync(password));
	console.warn(
		`password reset for '${username}' via RESET_ADMIN — remove RESET_ADMIN/RESET_ADMIN_PASSWORD from the environment now`
	);
}
