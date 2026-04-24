import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass through request and log', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/test',
          headers: { 'x-request-id': 'test-id' },
        }),
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = { handle: () => of({ data: 'test' }) };

    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: (data) => {
        expect(data).toEqual({ data: 'test' });
        done();
      },
    });
  });
});
