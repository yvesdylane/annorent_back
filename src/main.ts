import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DatabaseService } from './db/databaseService.js';
import { runMigrations } from './db/migrate.js';
import { getPort } from './config/env.js';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = getPort();
  const url = `http://localhost:${port}`;

  try {
    const db = app.get(DatabaseService);
    await db.query('SELECT 1');
    console.log('[Bootstrap] Database connected');
    const applied = await runMigrations(db.getPool());
    if (applied.length > 0) {
      console.log(`[Bootstrap] Applied ${applied.length} migration(s): ${applied.join(', ')}`);
    } else {
      console.log('[Bootstrap] No pending migrations');
    }
  } catch (err) {
    console.error('[Bootstrap] Error:', err instanceof Error ? err.message : String(err));
    await app.close();
    process.exit(1);
  }

  await app.listen(port);

  console.log(`[Bootstrap] Annorent API is running on ${url}`);
  console.log(`[Bootstrap] To test the app, hit GET ${url}/hello`);
}

void bootstrap();
