import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './authService.js';
import { AuthController } from './authController.js';
import { JwtStrategy } from './strategies/jwtStrategy.js';
import { GoogleStrategy } from './strategies/googleStrategy.js';
import { UserService } from '../users/userService.js';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, UserService],
  exports: [AuthService],
})
export class AuthModule {}
