import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const adminUserIds = (process.env.ADMIN_USER_IDS || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    const userEmail = (user.email || '').toLowerCase();
    const userId = user.userId || user.sub || user.id;

    if (adminEmails.includes(userEmail) || adminUserIds.includes(userId)) {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}
