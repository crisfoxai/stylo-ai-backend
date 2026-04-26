import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OutfitsService } from './outfits.service';
import { Outfit } from './schemas/outfit.schema';
import { FavoriteOutfit } from './schemas/favorite-outfit.schema';
import { WornEntry } from './schemas/worn-entry.schema';
import { OutfitsGenerator } from './outfits.generator';
import { WeatherService } from '../weather/weather.service';
import { UsersService } from '../users/users.service';

describe('OutfitsService', () => {
  let service: OutfitsService;
  let mockOutfitModel: { create: jest.Mock; findOne: jest.Mock; find: jest.Mock };
  let mockFavoriteModel: { updateOne: jest.Mock; deleteOne: jest.Mock; find: jest.Mock };
  let mockWornModel: { create: jest.Mock; find: jest.Mock; countDocuments: jest.Mock };
  let mockGenerator: { compose: jest.Mock };
  let mockWeatherService: { getByLocation: jest.Mock };
  let mockUsersService: { getStyleProfile: jest.Mock };

  const userId = new Types.ObjectId().toString();
  const outfitId = new Types.ObjectId().toString();

  beforeEach(async () => {
    const chainMock = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) };
    mockOutfitModel = { create: jest.fn(), findOne: jest.fn(), find: jest.fn().mockReturnValue(chainMock) };
    mockFavoriteModel = { updateOne: jest.fn(), deleteOne: jest.fn(), find: jest.fn() };
    mockWornModel = { create: jest.fn(), find: jest.fn(), countDocuments: jest.fn() };
    mockGenerator = { compose: jest.fn().mockResolvedValue({ items: [], garments: [], aiModel: 'test' }) };
    mockWeatherService = { getByLocation: jest.fn().mockResolvedValue({ tempC: 20, condition: 'clear', lat: 0, lon: 0 }) };
    mockUsersService = { getStyleProfile: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutfitsService,
        { provide: getModelToken(Outfit.name), useValue: mockOutfitModel },
        { provide: getModelToken(FavoriteOutfit.name), useValue: mockFavoriteModel },
        { provide: getModelToken(WornEntry.name), useValue: mockWornModel },
        { provide: OutfitsGenerator, useValue: mockGenerator },
        { provide: WeatherService, useValue: mockWeatherService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<OutfitsService>(OutfitsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should generate outfit without weather', async () => {
      const mockOutfit = { _id: new Types.ObjectId(), occasion: 'casual', items: [] };
      mockOutfitModel.create.mockResolvedValue(mockOutfit);

      const result = await service.generate(userId, { occasion: 'casual' });
      expect((result as unknown as Record<string, unknown>).id).toBe(String(mockOutfit._id));
      expect((result as unknown as Record<string, unknown>).name).toBe('Outfit generado');
      expect((result as unknown as Record<string, unknown>).garments).toEqual([]);
      expect(mockWeatherService.getByLocation).not.toHaveBeenCalled();
    });

    it('should generate outfit with weather context', async () => {
      const mockOutfit = { _id: new Types.ObjectId(), occasion: 'casual', items: [] };
      mockOutfitModel.create.mockResolvedValue(mockOutfit);

      await service.generate(userId, { occasion: 'casual', lat: 40.7, lon: -74.0 });
      expect(mockWeatherService.getByLocation).toHaveBeenCalledWith(40.7, -74.0);
    });
  });

  describe('addFavorite / removeFavorite', () => {
    it('should add favorite', async () => {
      mockFavoriteModel.updateOne.mockResolvedValue({});
      await expect(service.addFavorite(userId, outfitId)).resolves.not.toThrow();
    });

    it('should remove favorite', async () => {
      mockFavoriteModel.deleteOne.mockResolvedValue({});
      await expect(service.removeFavorite(userId, outfitId)).resolves.not.toThrow();
    });
  });

  describe('markWorn', () => {
    it('should throw NotFoundException if outfit not found', async () => {
      mockOutfitModel.findOne.mockResolvedValue(null);
      await expect(service.markWorn(userId, outfitId)).rejects.toThrow(NotFoundException);
    });

    it('should create worn entry if outfit exists', async () => {
      mockOutfitModel.findOne.mockResolvedValue({ _id: outfitId });
      mockWornModel.create.mockResolvedValue({ userId, outfitId, wornDate: new Date() });

      const result = await service.markWorn(userId, outfitId);
      expect(result).toBeDefined();
    });
  });

  describe('listByUser', () => {
    it('should return paginated outfits', async () => {
      const mockOutfits = [{ _id: new Types.ObjectId(), occasion: 'casual' }];
      const chainMock = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(mockOutfits) };
      mockOutfitModel.find.mockReturnValue(chainMock);

      const result = await service.listByUser(userId, 1, 20);
      expect(result).toHaveLength(1);
    });
  });

  describe('getHistory', () => {
    it('should return history filtered by month', async () => {
      const mockEntries = [{ userId, outfitId, wornDate: new Date() }];
      mockWornModel.find.mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(mockEntries) });

      const result = await service.getHistory(userId, { month: '2026-04' });
      expect(result).toHaveLength(1);
    });
  });
});
