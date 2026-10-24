import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';
import { createDatabasePool } from './pool.js';

export const PG_POOL = Symbol('PG_POOL');

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool: Pool;

  constructor() {
    this.pool = createDatabasePool();
  }

  getPool(): Pool {
    return this.pool;
  }

  async query(text: string, params?: unknown[]) {
    return this.pool.query(text, params);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
