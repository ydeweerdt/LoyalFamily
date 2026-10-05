import m001 from './001_init.sql?raw';

export interface Migration {
	version: number;
	name: string;
	sql: string;
}

/** Ordered migration list. Append new migrations; never edit released ones. */
export const migrations: Migration[] = [
	{ version: 1, name: '001_init', sql: m001 }
];
