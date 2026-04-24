import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let mockService: { getByUserId: jest.Mock; verifyReceipt: jest.Mock };

  const mockUser = { _id: new Types.ObjectId(), email: 'test@test.com' };

  beforeEach(async () => {
    mockService = { getByUserId: jest.fn(), verifyReceipt: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [{ provide: SubscriptionsService, useValue: mockService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getMe - should return subscription', async () => {
    const mockSub = { plan: 'free', status: 'free' };
    mockService.getByUserId.mockResolvedValue(mockSub);
    const result = await controller.getMe(mockUser as never);
    expect(result.plan).toBe('free');
  });

  it('verifyReceipt - should verify and return subscription', async () => {
    const mockSub = { plan: 'premium', status: 'active' };
    mockService.verifyReceipt.mockResolvedValue(mockSub);
    const result = await controller.verifyReceipt(mockUser as never, { platform: 'apple', receipt: 'abc' });
    expect(result.plan).toBe('premium');
  });
});
