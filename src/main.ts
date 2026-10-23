import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;
  const url = `http://localhost:${port}`;

  await app.listen(port);

  Logger.log(`Annorent API is running on ${url}`, 'Bootstrap');
  Logger.log(`To test the app, hit GET ${url}/hello`, 'Bootstrap');
}

void bootstrap();
