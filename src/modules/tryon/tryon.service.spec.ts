import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TryonService } from './tryon.service';
import { TryonResult } from './schemas/tryon-result.schema';
import { WardrobeItem } from '../wardrobe/schemas/wardrobe-item.schema';
import { AIService } from '../ai/ai.service';
import { R2Service } from '../storage/r2.service';

describe('TryonService', () => {
  let service: TryonService;
  let mockTryonModel: { create: jest.Mock; countDocuments: jest.Mock };
  let mockWardrobeModel: { find: jest.Mock };
  let mockAIService: { tryon: jest.Mock };
  let mockR2Service: { uploadStream: jest.Mock; bucketAvatars: jest.Mock };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mockTryonModel = { create: jest.fn(), countDocuments: jest.fn() };
    mockWardrobeModel = { find: jest.fn() };
    mockAIService = { tryon: jest.fn().mockResolvedValue({ resultUrl: 'https://r2.example.com/result.jpg' }) };
    mockR2Service = {
      uploadStream: jest.fn().mockResolvedValue('https://r2.example.com/photo.jpg'),
      bucketAvatars: jest.fn().mockReturnValue('avatars-bucket'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TryonService,
        { provide: getModelToken(TryonResult.name), useValue: mockTryonModel },
        { provide: getModelToken(WardrobeItem.name), useValue: mockWardrobeModel },
        { provide: AIService, useValue: mockAIService },
        { provide: R2Service, useValue: mockR2Service },
      ],
    }).compile();

    service = module.get<TryonService>(TryonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('tryon', () => {
    const mockFile = { originalname: 'photo.jpg', buffer: Buffer.from(''), mimetype: 'image/jpeg' } as Express.Multer.File;

    it('should create tryon result for premium user', async () => {
      const mockResult = { _id: new Types.ObjectId(), userId, resultUrl: 'https://r2.example.com/result.jpg' };
      const mockFind = { lean: jest.fn().mockResolvedValue([]) };
      mockWardrobeModel.find.mockReturnValue(mockFind);
      mockTryonModel.create.mockResolvedValue(mockResult);

      const result = await service.tryon(userId, mockFile, undefined, [], true);
      expect(result.resultUrl).toBeDefined();
    });

    it('should throw ForbiddenException for free user over limit', async () => {
      mockTryonModel.countDocuments.mockResolvedValue(3);

      await expect(service.tryon(userId, mockFile, undefined, [], false)).rejects.toThrow(ForbiddenException);
    });

    it('should allow free user within limit', async () => {
      mockTryonModel.countDocuments.mockResolvedValue(1);
      const mockResult = { _id: new Types.ObjectId(), userId, resultUrl: 'https://r2.example.com/result.jpg' };
      const mockFind = { lean: jest.fn().mockResolvedValue([]) };
      mockWardrobeModel.find.mockReturnValue(mockFind);
      mockTryonModel.create.mockResolvedValue(mockResult);

      const result = await service.tryon(userId, mockFile, undefined, [], false);
      expect(result).toBeDefined();
    });
  });
});
