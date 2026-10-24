import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DatabaseService } from './db/databaseService.js';
import { runMigrations } from './db/migrate.js';
import { getPort } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = getPort();
  const url = `http://localhost:${port}`;

  try {
    const db = app.get(DatabaseService);
    await db.query('SELECT 1');
    Logger.log('Database connected', 'Bootstrap');
    const applied = await runMigrations(db.getPool());
    if (applied.length > 0) {
      Logger.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`, 'Bootstrap');
    } else {
      Logger.log('No pending migrations', 'Bootstrap');
    }
  } catch (err) {
    Logger.error(err instanceof Error ? err.message : String(err), undefined, 'Bootstrap');
    await app.close();
    process.exit(1);
  }

  await app.listen(port);

  Logger.log(`Annorent API is running on ${url}`, 'Bootstrap');
  Logger.log(`To test the app, hit GET ${url}/hello`, 'Bootstrap');
}

void bootstrap();
