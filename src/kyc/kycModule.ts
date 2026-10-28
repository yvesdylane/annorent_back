import { Module } from '@nestjs/common';
import { KycService } from './kycService.js';
import { KycController, AdminKycController } from './kycController.js';
import { StorageModule } from '../storage/storageModule.js';
import { DatabaseModule } from '../db/dbModule.js';

@Module({
  imports: [StorageModule, DatabaseModule],
  controllers: [KycController, AdminKycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
