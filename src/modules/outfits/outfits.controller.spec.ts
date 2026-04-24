import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { OutfitsController } from './outfits.controller';
import { OutfitsService } from './outfits.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';

describe('OutfitsController', () => {
  let controller: OutfitsController;
  let mockService: {
    listByUser: jest.Mock;
    generate: jest.Mock;
    addFavorite: jest.Mock;
    removeFavorite: jest.Mock;
    markWorn: jest.Mock;
    getHistory: jest.Mock;
    getFavorites: jest.Mock;
  };

  const mockUser = { _id: new Types.ObjectId(), firebaseUid: 'fb123' };

  beforeEach(async () => {
    mockService = {
      listByUser: jest.fn(),
      generate: jest.fn(),
      addFavorite: jest.fn(),
      removeFavorite: jest.fn(),
      markWorn: jest.fn(),
      getHistory: jest.fn(),
      getFavorites: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OutfitsController],
      providers: [{ provide: OutfitsService, useValue: mockService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OutfitsController>(OutfitsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('list - should return paginated outfits', async () => {
    const mockOutfits = [{ _id: new Types.ObjectId(), occasion: 'casual' }];
    mockService.listByUser.mockResolvedValue(mockOutfits);
    const result = await controller.list(mockUser as never, 1, 20);
    expect(result).toHaveLength(1);
    expect(mockService.listByUser).toHaveBeenCalledWith(String(mockUser._id), 1, 20);
  });

  it('generate - should call service.generate', async () => {
    const mockOutfit = { _id: new Types.ObjectId(), occasion: 'casual' };
    mockService.generate.mockResolvedValue(mockOutfit);
    const result = await controller.generate(mockUser as never, { occasion: 'casual' });
    expect(result).toEqual(mockOutfit);
  });

  it('addFavorite - should call service.addFavorite', async () => {
    mockService.addFavorite.mockResolvedValue(undefined);
    await expect(controller.addFavorite(mockUser as never, 'outfit-id')).resolves.not.toThrow();
  });

  it('removeFavorite - should call service.removeFavorite', async () => {
    mockService.removeFavorite.mockResolvedValue(undefined);
    await expect(controller.removeFavorite(mockUser as never, 'outfit-id')).resolves.not.toThrow();
  });

  it('markWorn - should call service.markWorn', async () => {
    mockService.markWorn.mockResolvedValue({ wornDate: new Date() });
    const result = await controller.markWorn(mockUser as never, 'outfit-id');
    expect(result).toBeDefined();
  });

  it('getHistory - should return history', async () => {
    mockService.getHistory.mockResolvedValue([]);
    const result = await controller.getHistory(mockUser as never, {});
    expect(result).toEqual([]);
  });

  it('getFavorites - should return favorites', async () => {
    mockService.getFavorites.mockResolvedValue([]);
    const result = await controller.getFavorites(mockUser as never);
    expect(result).toEqual([]);
  });
});
