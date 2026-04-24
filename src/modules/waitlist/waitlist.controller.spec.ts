import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { ThrottlerModule } from '@nestjs/throttler';

describe('WaitlistController', () => {
  let controller: WaitlistController;
  let mockService: { register: jest.Mock };

  beforeEach(async () => {
    mockService = { register: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [WaitlistController],
      providers: [{ provide: WaitlistService, useValue: mockService }],
    }).compile();

    controller = module.get<WaitlistController>(WaitlistController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('register - should register email', async () => {
    mockService.register.mockResolvedValue({ message: 'registered' });
    const result = await controller.register({ email: 'test@test.com' });
    expect(result.message).toBe('registered');
  });
});
