import { Module } from '@nestjs/common';
import { EmailService } from './emailService.js';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
