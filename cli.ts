import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module.js';
import { DatabaseService } from './src/db/databaseService.js';
import { seedAdmin } from './src/db/seedAdmin.js';
import { runMigrations } from './src/db/migrate.js';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const db = app.get(DatabaseService);
    await runMigrations(db.getPool());
    await seedAdmin(db.getPool());
    console.log('Admin seeding completed');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void main();
