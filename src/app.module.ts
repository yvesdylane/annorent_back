import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './db/dbModule.js';
import { UserModule } from './userModule.js';
import { AuthModule } from './auth/authModule.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    AuthModule,
    UserModule,
  ],
})
export class AppModule {}
