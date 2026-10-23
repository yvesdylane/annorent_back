import { Module } from '@nestjs/common';
import { UserRouter } from './routers/userRouter.js';
import { UserService } from './services/userService.js';

@Module({
  controllers: [UserRouter],
  providers: [UserService],
})
export class UserModule {}
