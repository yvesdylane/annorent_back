import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../../db/databaseService.js';

@Injectable()
export class RequireVerifiedOwnerGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    const userId = user.userId || user.sub || user.id;

    const result = await this.db.query(
      `SELECT role, kyc_status FROM public.users WHERE user_id = $1`,
      [userId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new UnauthorizedException();
    }

    if (row.role === 'owner' && row.kyc_status === 'verified') {
      return true;
    }

    throw new ForbiddenException('Complete and verify your KYC to list properties');
  }
}
