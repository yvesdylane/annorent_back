import { Pool } from 'pg';
import { getDatabaseUrl } from '../config/env.js';

export function createDatabasePool(): Pool {
  const connectionString = getDatabaseUrl();
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}
