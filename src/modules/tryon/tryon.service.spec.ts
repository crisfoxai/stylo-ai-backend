import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TryonService } from './tryon.service';
import { TryonResult } from './schemas/tryon-result.schema';
import { WardrobeItem } from '../wardrobe/schemas/wardrobe-item.schema';
import { AIService } from '../ai/ai.service';
import { R2Service } from '../storage/r2.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

describe('TryonService', () => {
  let service: TryonService;
  let mockTryonModel: { create: jest.Mock; findOne: jest.Mock };
  let mockWardrobeModel: { findOne: jest.Mock };
  let mockAIService: { tryon: jest.Mock };
  let mockR2Service: { uploadStream: jest.Mock; bucketAvatars: jest.Mock };
  let mockSubscriptionsService: { checkAndIncrementUsage: jest.Mock };

  const userId = new Types.ObjectId().toString();
  const garmentId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mockTryonModel = {
      create: jest.fn(),
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    };
    mockWardrobeModel = {
      findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ imageUrl: 'https://r2.example.com/garment.jpg', name: 'Test garment', type: 'top', color: 'blue', category: 'shirt' }) }),
    };
    mockAIService = { tryon: jest.fn().mockResolvedValue({ resultUrl: 'https://r2.example.com/result.jpg' }) };
    mockR2Service = {
      uploadStream: jest.fn().mockResolvedValue('https://r2.example.com/photo.jpg'),
      bucketAvatars: jest.fn().mockReturnValue('avatars-bucket'),
    };
    mockSubscriptionsService = { checkAndIncrementUsage: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TryonService,
        { provide: getModelToken(TryonResult.name), useValue: mockTryonModel },
        { provide: getModelToken(WardrobeItem.name), useValue: mockWardrobeModel },
        { provide: AIService, useValue: mockAIService },
        { provide: R2Service, useValue: mockR2Service },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    }).compile();

    service = module.get<TryonService>(TryonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('tryon', () => {
    const mockFile = { originalname: 'photo.jpg', buffer: Buffer.from('test'), mimetype: 'image/jpeg' } as Express.Multer.File;

    it('should create tryon result for pro user', async () => {
      const mockResult = { _id: new Types.ObjectId(), userId, resultUrl: 'https://r2.example.com/result.jpg', cacheKey: 'abc' };
      mockTryonModel.create.mockResolvedValue(mockResult);

      const result = await service.tryon(userId, mockFile, garmentId);
      expect(result.resultUrl).toBeDefined();
      expect(mockSubscriptionsService.checkAndIncrementUsage).toHaveBeenCalledWith(userId, 'tryon');
    });

    it('should throw ForbiddenException when plan limit exceeded', async () => {
      mockSubscriptionsService.checkAndIncrementUsage.mockRejectedValue(new ForbiddenException({ error: 'PLAN_LIMIT' }));

      await expect(service.tryon(userId, mockFile, garmentId)).rejects.toThrow(ForbiddenException);
    });

    it('should return cached result without calling Replicate again', async () => {
      const cachedResult = { _id: new Types.ObjectId(), userId, resultUrl: 'https://cached.com/result.jpg', cacheKey: 'abc' };
      mockTryonModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(cachedResult) });

      const result = await service.tryon(userId, mockFile, garmentId);
      expect(result.resultUrl).toBe('https://cached.com/result.jpg');
      expect(mockAIService.tryon).not.toHaveBeenCalled();
    });
  });
});
