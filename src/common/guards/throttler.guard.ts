import { Injectable, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';
import { UserDocument } from '../../modules/users/schemas/user.schema';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = (req as unknown) as Request & { user?: UserDocument };
    if (request.user?._id) {
      return String(request.user._id);
    }
    const forwarded = request.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? request.ip ?? 'unknown');
    return String(ip).split(',')[0].trim();
  }

  protected throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        error: 'RATE_LIMIT',
        message: 'Demasiadas solicitudes. Por favor esperá unos segundos antes de intentar de nuevo.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export { ThrottlerException };
