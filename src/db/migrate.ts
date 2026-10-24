import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Pool } from 'pg';

function isSql(file: string): boolean {
  return file.endsWith('.sql');
}

function sortMigrations(files: string[]): string[] {
  return [...files].sort((a, b) => a.localeCompare(b));
}

export async function runMigrations(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS public.app_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`,
    );

    const dirs = [
      resolve(process.cwd(), 'src/db/migrations'),
      resolve(process.cwd(), 'db/migrations'),
      resolve(process.cwd(), 'dist/db/migrations'),
    ];

    let migrationDir: string | null = null;
    for (const dir of dirs) {
      try {
        const entries = await readdir(dir);
        if (entries.some(isSql)) {
          migrationDir = dir;
          break;
        }
      } catch {
        // ignore
      }
    }

    if (!migrationDir) {
      return [];
    }

    const entries = await readdir(migrationDir);
    const files = sortMigrations(entries.filter(isSql));

    const { rows } = await client.query('SELECT version FROM public.app_migrations');
    const applied = new Set(rows.map((r) => r.version));

    const appliedNow: string[] = [];

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = await readFile(join(migrationDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('annorent_migrations'))");
        await client.query(sql);
        await client.query('INSERT INTO public.app_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        appliedNow.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    return appliedNow;
  } finally {
    client.release();
  }
}
