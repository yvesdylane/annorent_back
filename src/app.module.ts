import { Module } from '@nestjs/common';
import { DatabaseModule } from './db/dbModule.js';
import { UserModule } from './userModule.js';

@Module({
  imports: [DatabaseModule, UserModule],
})
export class AppModule {}
