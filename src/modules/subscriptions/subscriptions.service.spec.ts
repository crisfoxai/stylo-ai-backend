import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from './schemas/subscription.schema';

jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let mockSubscriptionModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
    updateOne: jest.Mock;
    updateMany: jest.Mock;
  };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mockSubscriptionModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
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
      const mockSub = { _id: new Types.ObjectId(), userId, plan: 'pro', status: 'active' };
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
    it('should activate pro tier for valid Apple receipt', async () => {
      const mockAppleResponse = {
        data: {
          status: 0,
          latest_receipt_info: [{
            product_id: 'stylo_pro_monthly',
            expires_date_ms: String(Date.now() + 30 * 24 * 60 * 60 * 1000),
            original_transaction_id: 'txn_123',
          }],
        },
      };
      mockedAxios.post.mockResolvedValue(mockAppleResponse);
      const mockSub = { plan: 'pro', status: 'active', platform: 'apple' };
      mockSubscriptionModel.findOneAndUpdate.mockResolvedValue(mockSub);

      const result = await service.verifyReceipt(userId, { platform: 'apple', receipt: 'valid-receipt-data' });
      expect(result.plan).toBe('pro');
    });

    it('should throw BadRequestException for invalid Apple receipt', async () => {
      mockedAxios.post.mockResolvedValue({ data: { status: 21002 } });

      await expect(
        service.verifyReceipt(userId, { platform: 'apple', receipt: 'invalid' }),
      ).rejects.toThrow();
    });
  });

  describe('checkAndIncrementUsage', () => {
    it('should throw ForbiddenException when plan limit is reached', async () => {
      const mockSub = {
        plan: 'pro',
        tryonUsedThisMonth: 20,
        chatMessagesUsedThisMonth: 0,
        periodStart: new Date(),
      };
      mockSubscriptionModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockSub) });

      await expect(service.checkAndIncrementUsage(userId, 'tryon')).rejects.toThrow();
    });

    it('should increment usage when under limit', async () => {
      const mockSub = {
        plan: 'pro',
        tryonUsedThisMonth: 5,
        chatMessagesUsedThisMonth: 0,
        periodStart: new Date(),
      };
      mockSubscriptionModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockSub) });

      await expect(service.checkAndIncrementUsage(userId, 'tryon')).resolves.not.toThrow();
      expect(mockSubscriptionModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        { $inc: { tryonUsedThisMonth: 1 } },
      );
    });

    it('should throw for free tier tryon', async () => {
      const mockSub = {
        plan: 'free',
        tryonUsedThisMonth: 0,
        chatMessagesUsedThisMonth: 0,
        periodStart: new Date(),
      };
      mockSubscriptionModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockSub) });

      await expect(service.checkAndIncrementUsage(userId, 'tryon')).rejects.toThrow();
    });
  });

  describe('handleAppleWebhook', () => {
    it('should handle webhook without throwing', async () => {
      await expect(service.handleAppleWebhook('abc')).resolves.not.toThrow();
    });
  });

  describe('handleGoogleWebhook', () => {
    it('should handle webhook without throwing', async () => {
      await expect(service.handleGoogleWebhook({ message: { data: 'abc' } })).resolves.not.toThrow();
    });
  });
});
