import m001 from './001_init.sql?raw';
import m002 from './002_token_version.sql?raw';
import m003 from './003_symbologies.sql?raw';

export interface Migration {
	version: number;
	name: string;
	sql: string;
}

/** Ordered migration list. Append new migrations; never edit released ones. */
export const migrations: Migration[] = [
	{ version: 1, name: '001_init', sql: m001 },
	{ version: 2, name: '002_token_version', sql: m002 },
	{ version: 3, name: '003_symbologies', sql: m003 }
];
