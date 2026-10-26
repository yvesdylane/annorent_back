import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../authService.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      const name = profile.displayName || [profile.name?.givenName, profile.name?.familyName].filter(Boolean).join(' ') || email || 'Google User';
      const providerId = profile.id;

      const user = await this.authService.findOrCreateGoogleUser({
        email,
        name,
        providerId,
      });

      done(null, user);
    } catch (err) {
      done(err as Error, false);
    }
  }
}
