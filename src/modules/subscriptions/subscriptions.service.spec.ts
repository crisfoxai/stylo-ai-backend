import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from './schemas/subscription.schema';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let mockSubscriptionModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mockSubscriptionModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: getModelToken(Subscription.name), useValue: mockSubscriptionModel },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getByUserId', () => {
    it('should return existing subscription', async () => {
      const mockSub = { _id: new Types.ObjectId(), userId, plan: 'premium', status: 'active' };
      mockSubscriptionModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockSub) });

      const result = await service.getByUserId(userId);
      expect(result).toEqual(mockSub);
    });

    it('should create free subscription if none exists', async () => {
      const mockSub = { userId, plan: 'free', status: 'free' };
      mockSubscriptionModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      mockSubscriptionModel.create.mockResolvedValue(mockSub);

      const result = await service.getByUserId(userId);
      expect(result.plan).toBe('free');
    });
  });

  describe('verifyReceipt', () => {
    it('should activate premium for valid receipt', async () => {
      const mockSub = { plan: 'premium', status: 'active', platform: 'apple' };
      mockSubscriptionModel.findOneAndUpdate.mockResolvedValue(mockSub);

      const result = await service.verifyReceipt(userId, { platform: 'apple', receipt: 'valid-receipt-data' });
      expect(result.plan).toBe('premium');
    });

    it('should keep free for empty receipt', async () => {
      const mockSub = { plan: 'free', status: 'free', platform: 'apple' };
      mockSubscriptionModel.findOneAndUpdate.mockResolvedValue(mockSub);

      const result = await service.verifyReceipt(userId, { platform: 'apple', receipt: '' });
      expect(result.plan).toBe('free');
    });
  });

  describe('handleAppleWebhook', () => {
    it('should handle webhook without throwing', async () => {
      await expect(service.handleAppleWebhook({ signedPayload: 'abc' })).resolves.not.toThrow();
    });
  });

  describe('handleGoogleWebhook', () => {
    it('should handle webhook without throwing', async () => {
      await expect(service.handleGoogleWebhook({ message: { data: 'abc' } })).resolves.not.toThrow();
    });
  });
});
