import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { env } from '../env';

const dataDir = resolve(process.cwd(), env.dataDir);
mkdirSync(dataDir, { recursive: true });

export const dbPath = join(dataDir, 'app.db');

const database = new Database(dbPath, { create: true, strict: true });
database.exec('PRAGMA journal_mode = WAL;');
database.exec('PRAGMA foreign_keys = ON;');
database.exec('PRAGMA busy_timeout = 5000;');

export const db = database;
