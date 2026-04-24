import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { WardrobeController } from './wardrobe.controller';
import { WardrobeService } from './wardrobe.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';

describe('WardrobeController', () => {
  let controller: WardrobeController;
  let mockService: {
    create: jest.Mock;
    list: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
  };

  const mockUser = { _id: new Types.ObjectId(), firebaseUid: 'fb123', email: 'test@test.com' };

  beforeEach(async () => {
    mockService = {
      create: jest.fn(),
      list: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WardrobeController],
      providers: [{ provide: WardrobeService, useValue: mockService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WardrobeController>(WardrobeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create wardrobe item', async () => {
      const mockItem = { _id: new Types.ObjectId(), status: 'processing' };
      mockService.create.mockResolvedValue(mockItem);

      const file = { originalname: 'test.jpg', buffer: Buffer.from('') } as Express.Multer.File;
      const result = await controller.create(mockUser as never, file);
      expect(result.status).toBe('processing');
    });
  });

  describe('list', () => {
    it('should list wardrobe items', async () => {
      const mockResult = { items: [], total: 0, page: 1 };
      mockService.list.mockResolvedValue(mockResult);
      const result = await controller.list(mockUser as never, {});
      expect(result).toEqual(mockResult);
    });
  });

  describe('findOne', () => {
    it('should return single item', async () => {
      const mockItem = { _id: new Types.ObjectId(), status: 'ready' };
      mockService.findOne.mockResolvedValue(mockItem);
      const result = await controller.findOne(mockUser as never, String(mockItem._id));
      expect(result).toEqual(mockItem);
    });
  });

  describe('update', () => {
    it('should update item tags', async () => {
      const mockItem = { _id: new Types.ObjectId(), tags: ['summer'] };
      mockService.update.mockResolvedValue(mockItem);
      const result = await controller.update(mockUser as never, String(mockItem._id), { tags: ['summer'] });
      expect(result.tags).toContain('summer');
    });
  });

  describe('remove', () => {
    it('should soft delete item', async () => {
      mockService.softDelete.mockResolvedValue(undefined);
      await expect(controller.remove(mockUser as never, new Types.ObjectId().toString())).resolves.not.toThrow();
    });
  });
});
