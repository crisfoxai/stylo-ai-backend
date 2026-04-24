import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { NotificationsService } from './notifications.service';
import { PushToken } from './schemas/push-token.schema';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockTokenModel: { findOneAndUpdate: jest.Mock; deleteOne: jest.Mock; find: jest.Mock };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mockTokenModel = {
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getModelToken(PushToken.name), useValue: mockTokenModel },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerToken', () => {
    it('should upsert push token', async () => {
      const mockToken = { userId, token: 'test-token', platform: 'ios' };
      mockTokenModel.findOneAndUpdate.mockResolvedValue(mockToken);
      const result = await service.registerToken(userId, { token: 'test-token', platform: 'ios' });
      expect(result).toEqual(mockToken);
    });
  });

  describe('unregisterToken', () => {
    it('should delete push token', async () => {
      mockTokenModel.deleteOne.mockResolvedValue({ deletedCount: 1 });
      await expect(service.unregisterToken(userId, 'test-token')).resolves.not.toThrow();
    });
  });

  describe('sendDailyOutfitNotification', () => {
    it('should fetch tokens and log', async () => {
      const mockFind = { limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
      mockTokenModel.find.mockReturnValue(mockFind);
      await expect(service.sendDailyOutfitNotification()).resolves.not.toThrow();
    });
  });
});
