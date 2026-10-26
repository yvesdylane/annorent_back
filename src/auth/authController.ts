import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './authService.js';
import { RegisterDto } from './dto/registerDto.js';
import { LoginDto } from './dto/loginDto.js';
import { RefreshDto } from './dto/refreshDto.js';
import { JwtAuthGuard } from './guards/jwtAuthGuard.js';
import { GoogleAuthGuard } from './guards/googleAuthGuard.js';
import { UserService } from '../users/userService.js';
import type { PublicUser } from '../models/User.js';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly userService: UserService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any): PublicUser {
    return this.userService.toPublicUser(req.user);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    // Initiates Google OAuth
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    const user = req.user;
    const result = await this.authService.loginGoogleUser(user);
    const name = encodeURIComponent(result.user?.name || 'Unknown');
    const email = encodeURIComponent(result.user?.email || '');
    return res.redirect(`/auth/google/success?name=${name}&email=${email}`);
  }

  @Get('google/success')
  googleAuthSuccess(@Req() req: any) {
    const name = req.query?.name || 'Unknown';
    const email = req.query?.email || '';
    return `Google auth successful for user ${name}, email ${email}`;
  }
}
