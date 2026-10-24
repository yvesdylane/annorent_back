import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './databaseService.js';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
