import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { AuthService } from '../../modules/auth/auth.service';

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;
  let mockAuthService: { verifyAndLoadUser: jest.Mock };

  beforeEach(async () => {
    mockAuthService = { verifyAndLoadUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthGuard,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    guard = module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
  });

  function createMockContext(authHeader?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: authHeader } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should throw UnauthorizedException when no auth header', async () => {
    await expect(guard.canActivate(createMockContext())).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when not Bearer token', async () => {
    await expect(guard.canActivate(createMockContext('Basic abc123'))).rejects.toThrow(UnauthorizedException);
  });

  it('should return true when token is valid', async () => {
    const mockUser = { _id: 'uid', firebaseUid: 'fb123' };
    mockAuthService.verifyAndLoadUser.mockResolvedValue(mockUser);
    const result = await guard.canActivate(createMockContext('Bearer valid-token'));
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    mockAuthService.verifyAndLoadUser.mockRejectedValue(new Error('Invalid'));
    await expect(guard.canActivate(createMockContext('Bearer bad-token'))).rejects.toThrow(UnauthorizedException);
  });
});
