import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-internal-key'];
    const expected = this.configService.get<string>('AI_SERVICE_INTERNAL_KEY');

    if (!key || key !== expected) {
      throw new UnauthorizedException({ error: 'AUTH_INVALID' });
    }
    return true;
  }
}
