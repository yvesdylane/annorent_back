import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend | null = null;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    if (key) {
      this.resend = new Resend(key);
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const baseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
    const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    if (!this.resend) {
      console.log(`[EmailService] Password reset link for ${email}: ${resetUrl} (token: ${resetToken})`);
      return;
    }

    try {
      await this.resend.emails.send({
        from,
        to: email,
        subject: 'Reset your password',
        html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour.</p><p>If you didn't request this, you can ignore this email.</p>`,
      });
      console.log(`[EmailService] Password reset email sent to ${email}`);
    } catch (err) {
      console.error('[EmailService] Failed to send password reset email:', err);
      console.log(`[EmailService] Fallback reset link for ${email}: ${resetUrl} (token: ${resetToken})`);
    }
  }
}
