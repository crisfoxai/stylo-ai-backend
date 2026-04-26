import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WardrobeService } from './wardrobe.service';
import { WardrobeItem } from './schemas/wardrobe-item.schema';
import { WardrobeJob } from './schemas/wardrobe-job.schema';
import { AIService } from '../ai/ai.service';
import { R2Service } from '../storage/r2.service';

describe('WardrobeService', () => {
  let service: WardrobeService;
  let mockItemModel: {
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    countDocuments: jest.Mock;
  };
  let mockJobModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let mockAIService: { classify: jest.Mock; removeBg: jest.Mock };
  let mockR2Service: {
    uploadStream: jest.Mock;
    bucketWardrobe: jest.Mock;
    bucketAvatars: jest.Mock;
  };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mockItemModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
    };

    mockJobModel = {
      create: jest.fn().mockResolvedValue({ jobId: 'test-job-id', status: 'processing' }),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    };

    mockAIService = {
      classify: jest.fn(),
      removeBg: jest.fn(),
    };

    mockR2Service = {
      uploadStream: jest.fn().mockResolvedValue('https://r2.example.com/item.jpg'),
      bucketWardrobe: jest.fn().mockReturnValue('wardrobe-bucket'),
      bucketAvatars: jest.fn().mockReturnValue('avatars-bucket'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WardrobeService,
        { provide: getModelToken(WardrobeItem.name), useValue: mockItemModel },
        { provide: getModelToken(WardrobeJob.name), useValue: mockJobModel },
        { provide: AIService, useValue: mockAIService },
        { provide: R2Service, useValue: mockR2Service },
      ],
    }).compile();

    service = module.get<WardrobeService>(WardrobeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create item with processing status', async () => {
      const mockItem = { _id: new Types.ObjectId(), status: 'processing' };
      mockItemModel.create.mockResolvedValue(mockItem);
      mockAIService.classify.mockResolvedValue({ type: 'top', color: 'red', category: 'top', material: 'cotton', confidence: 0.9 });
      mockAIService.removeBg.mockResolvedValue({ processedUrl: 'https://r2.example.com/processed.png' });
      mockItemModel.findByIdAndUpdate.mockResolvedValue({});

      const file = { originalname: 'test.jpg', buffer: Buffer.from(''), mimetype: 'image/jpeg' } as Express.Multer.File;
      const result = await service.create(userId, file);

      expect(result.status).toBe('processing');
      expect(mockR2Service.uploadStream).toHaveBeenCalled();
    });

    it('should mark item as failed when AI pipeline fails', async () => {
      const mockItem = { _id: new Types.ObjectId(), status: 'processing' };
      mockItemModel.create.mockResolvedValue(mockItem);
      mockAIService.classify.mockRejectedValue(new Error('AI error'));
      mockAIService.removeBg.mockRejectedValue(new Error('AI error'));
      mockItemModel.findByIdAndUpdate.mockResolvedValue({});

      const file = { originalname: 'test.jpg', buffer: Buffer.from(''), mimetype: 'image/jpeg' } as Express.Multer.File;
      await service.create(userId, file);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockItemModel.findByIdAndUpdate).toHaveBeenCalledWith(
        String(mockItem._id),
        { $set: { status: 'failed' } },
      );
    });
  });

  describe('list', () => {
    it('should return paginated items', async () => {
      const mockItems = [{ _id: new Types.ObjectId(), status: 'ready' }];
      const mockFind = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(mockItems) };
      mockItemModel.find.mockReturnValue(mockFind);
      mockItemModel.countDocuments.mockResolvedValue(1);

      const result = await service.list(userId, { page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when item not found', async () => {
      mockItemModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      await expect(service.findOne(userId, new Types.ObjectId().toString())).rejects.toThrow(NotFoundException);
    });

    it('should return item when found', async () => {
      const mockItem = { _id: new Types.ObjectId(), status: 'ready', userId };
      mockItemModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockItem) });
      const result = await service.findOne(userId, String(mockItem._id));
      expect(result.id).toBe(String(mockItem._id));
      expect(result.status).toBe('ready');
    });
  });

  describe('softDelete', () => {
    it('should throw NotFoundException when item not found', async () => {
      mockItemModel.findOne.mockResolvedValue(null);
      await expect(service.softDelete(userId, new Types.ObjectId().toString())).rejects.toThrow(NotFoundException);
    });

    it('should archive item when found', async () => {
      const itemId = new Types.ObjectId().toString();
      mockItemModel.findOne.mockResolvedValue({ _id: itemId, userId });
      mockItemModel.findByIdAndUpdate.mockResolvedValue({});
      await expect(service.softDelete(userId, itemId)).resolves.not.toThrow();
    });
  });

  describe('list with filters', () => {
    it('should apply category filter', async () => {
      const mockFind = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
      mockItemModel.find.mockReturnValue(mockFind);
      mockItemModel.countDocuments.mockResolvedValue(0);
      await service.list(userId, { category: 'top', page: 1, limit: 20 });
      expect(mockItemModel.find).toHaveBeenCalledWith(expect.objectContaining({ category: 'top' }));
    });

    it('should apply color filter', async () => {
      const mockFind = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
      mockItemModel.find.mockReturnValue(mockFind);
      mockItemModel.countDocuments.mockResolvedValue(0);
      await service.list(userId, { color: 'red', page: 1, limit: 20 });
      expect(mockItemModel.find).toHaveBeenCalledWith(expect.objectContaining({ color: 'red' }));
    });

    it('should apply search query filter', async () => {
      const mockFind = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
      mockItemModel.find.mockReturnValue(mockFind);
      mockItemModel.countDocuments.mockResolvedValue(0);
      await service.list(userId, { q: 'nike', page: 1, limit: 20 });
      expect(mockItemModel.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when item not found', async () => {
      mockItemModel.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      await expect(service.update(userId, new Types.ObjectId().toString(), { tags: ['x'] })).rejects.toThrow(NotFoundException);
    });

    it('should return updated item', async () => {
      const mockItem = { _id: new Types.ObjectId(), tags: ['summer'] };
      mockItemModel.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockItem) });
      const result = await service.update(userId, String(mockItem._id), { tags: ['summer'] });
      expect(result.tags).toContain('summer');
    });
  });
});
