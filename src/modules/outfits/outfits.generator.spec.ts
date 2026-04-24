import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { OutfitsGenerator } from './outfits.generator';
import { WardrobeItem } from '../wardrobe/schemas/wardrobe-item.schema';

describe('OutfitsGenerator', () => {
  let generator: OutfitsGenerator;
  let mockItemModel: { find: jest.Mock };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mockItemModel = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutfitsGenerator,
        { provide: getModelToken(WardrobeItem.name), useValue: mockItemModel },
      ],
    }).compile();

    generator = module.get<OutfitsGenerator>(OutfitsGenerator);
  });

  it('should be defined', () => {
    expect(generator).toBeDefined();
  });

  it('should compose outfit from available items', async () => {
    const mockItems = [
      { _id: new Types.ObjectId(), category: 'top', status: 'ready' },
      { _id: new Types.ObjectId(), category: 'bottom', status: 'ready' },
      { _id: new Types.ObjectId(), category: 'shoes', status: 'ready' },
    ];
    mockItemModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockItems) });

    const result = await generator.compose(userId, 'casual', undefined, undefined, null);
    expect(result.items.length).toBeGreaterThanOrEqual(0);
    expect(result.aiModel).toBe('rule-based-v1');
  });

  it('should return empty outfit when no items available', async () => {
    mockItemModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    const result = await generator.compose(userId, 'casual', undefined, undefined, null);
    expect(result.items).toHaveLength(0);
  });
});
