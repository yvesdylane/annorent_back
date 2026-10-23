import { Module } from '@nestjs/common';
import { UserModule } from './userModule.js';

@Module({
  imports: [UserModule],
})
export class AppModule {}
