import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './authService.js';
import { RegisterDto } from './dto/registerDto.js';
import { LoginDto } from './dto/loginDto.js';
import { RefreshDto } from './dto/refreshDto.js';
import { ForgotPasswordDto } from './dto/forgotPasswordDto.js';
import { ResetPasswordDto } from './dto/resetPasswordDto.js';
import { ChangePasswordDto } from './dto/changePasswordDto.js';
import { SetPasswordDto } from './dto/setPasswordDto.js';
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

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const email = dto.email || (dto as any).username || (dto as any).userEmail;
    return this.authService.requestPasswordReset(email);
  }

  @Get('reset-password')
  resetPasswordPage(@Query('token') token: string) {
    const safeToken = (token || '').replace(/"/g, '&quot;');
    return `<html><body><h2>Reset Your Password</h2><form method="post" action="/auth/reset-password"><input type="hidden" name="token" value="${safeToken}"/><input name="newPassword" type="password" placeholder="New password" minlength="8" required/><input name="confirmPassword" type="password" placeholder="Confirm password" minlength="8" required/><button type="submit">Reset Password</button></form></body></html>`;
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: any) {
    const body: any = dto;
    const token = body.token || body.resetToken || body.reset_password_token;
    const newPassword = body.newPassword || body.password;
    const confirmPassword = body.confirmPassword;
    if (!token || !newPassword) {
      throw new Error('Invalid or expired password reset token');
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    return this.authService.resetPassword(token as string, newPassword as string);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Req() req: any, @Body() dto: any) {
    const userId = req.user?.userId || req.user?.user_id || req.user?.id || req.user?.sub;
    const body: any = dto as any;
    const currentPassword = body.currentPassword || body.oldPassword || body.current_password;
    const newPassword = body.newPassword || body.password || body.new_password;
    return this.authService.changePassword(userId as string, currentPassword as string, newPassword as string);
  }

  @UseGuards(JwtAuthGuard)
  @Post('set-password')
  async setPassword(@Req() req: any, @Body() dto: SetPasswordDto) {
    const userId = req.user?.userId || req.user?.user_id || req.user?.id || req.user?.sub;
    return this.authService.setPassword(userId as string, dto.newPassword, dto.confirmPassword);
  }

  @Post('forgotPassword')
  async forgotPasswordAlt(@Body() dto: ForgotPasswordDto) {
    const email = dto.email || (dto as any).username || (dto as any).userEmail;
    return this.authService.requestPasswordReset(email);
  }

  @Post('resetPassword')
  async resetPasswordAlt(@Body() dto: any) {
    const body: any = dto;
    const token = body.token || body.resetToken || body.reset_password_token;
    const newPassword = body.newPassword || body.password;
    const confirmPassword = body.confirmPassword;
    if (!token || !newPassword) {
      throw new Error('Invalid or expired password reset token');
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    return this.authService.resetPassword(token as string, newPassword as string);
  }

  @UseGuards(JwtAuthGuard)
  @Post('changePassword')
  async changePasswordAlt(@Req() req: any, @Body() dto: any) {
    const userId = req.user?.userId || req.user?.user_id || req.user?.id || req.user?.sub;
    const body: any = dto;
    const currentPassword = body.currentPassword || body.oldPassword || body.current_password;
    const newPassword = body.newPassword || body.password || body.new_password;
    return this.authService.changePassword(userId as string, currentPassword as string, newPassword as string);
  }

  @Post('password/forgot')
  async forgotPasswordNested(@Body() dto: ForgotPasswordDto) {
    const email = dto.email || (dto as any).username || (dto as any).userEmail;
    return this.authService.requestPasswordReset(email);
  }

  @Post('password/reset')
  async resetPasswordNested(@Body() dto: any) {
    const body: any = dto;
    const token = body.token || body.resetToken || body.reset_password_token;
    const newPassword = body.newPassword || body.password;
    const confirmPassword = body.confirmPassword;
    if (!token || !newPassword) {
      throw new Error('Invalid or expired password reset token');
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    return this.authService.resetPassword(token as string, newPassword as string);
  }

  @UseGuards(JwtAuthGuard)
  @Post('password/change')
  async changePasswordNested(@Req() req: any, @Body() dto: any) {
    const userId = req.user?.userId || req.user?.user_id || req.user?.id || req.user?.sub;
    const body: any = dto;
    const currentPassword = body.currentPassword || body.oldPassword || body.current_password;
    const newPassword = body.newPassword || body.password || body.new_password;
    return this.authService.changePassword(userId as string, currentPassword as string, newPassword as string);
  }
}
