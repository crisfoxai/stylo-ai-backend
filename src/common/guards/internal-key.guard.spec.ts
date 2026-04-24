import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalKeyGuard } from './internal-key.guard';

describe('InternalKeyGuard', () => {
  let guard: InternalKeyGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalKeyGuard,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('secret-key') },
        },
      ],
    }).compile();

    guard = module.get<InternalKeyGuard>(InternalKeyGuard);
  });

  function mockContext(key?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-internal-key': key } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow request with valid key', () => {
    expect(guard.canActivate(mockContext('secret-key'))).toBe(true);
  });

  it('should throw UnauthorizedException with invalid key', () => {
    expect(() => guard.canActivate(mockContext('wrong-key'))).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException with no key', () => {
    expect(() => guard.canActivate(mockContext())).toThrow(UnauthorizedException);
  });
});
