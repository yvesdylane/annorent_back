import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv() {
  if (existsSync(resolve(process.cwd(), '.env'))) {
    try {
      process.loadEnvFile?.('.env');
    } catch {
      // ignore
    }
  }
}

loadDotEnv();

export function getDatabaseUrl(): string {
  const url = process.env.DB_TRANSACTION_POOLER || process.env.DB_CONNECTION_STRING;
  if (!url) {
    throw new Error('Missing DB_TRANSACTION_POOLER or DB_CONNECTION_STRING in environment');
  }
  return url;
}

export function getPort(): number {
  const port = Number(process.env.PORT);
  return Number.isFinite(port) ? port : 3000;
}
