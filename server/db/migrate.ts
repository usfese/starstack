import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from './index';

const MIGRATIONS_DIR = join(import.meta.dir, 'migrations');

export function migrate(): void {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const row = db.query('PRAGMA user_version').get() as { user_version: number } | null;
  let version = row?.user_version ?? 0;

  for (const file of files) {
    const fileVersion = Number.parseInt(file.slice(0, 3), 10);
    if (!Number.isFinite(fileVersion)) continue;
    if (fileVersion <= version) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${fileVersion}`);
    })();
    version = fileVersion;
    console.log(`[星栈] 已应用迁移 ${file}`);
  }

  console.log(`[星栈] 数据库迁移完成（version=${version}）`);
}

if (import.meta.main) {
  migrate();
}
