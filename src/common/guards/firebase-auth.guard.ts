import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({ error: 'AUTH_REQUIRED' });
    }

    const idToken = authHeader.split(' ')[1];

    try {
      const user = await this.authService.verifyAndLoadUser(idToken);
      (request as Request & { user: unknown }).user = user;
      return true;
    } catch (error) {
      this.logger.debug(`Auth failed: ${(error as Error).message}`);
      throw new UnauthorizedException({ error: 'AUTH_INVALID' });
    }
  }
}
