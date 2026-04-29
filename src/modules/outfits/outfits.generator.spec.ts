import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  OutfitsGenerator,
  preFilterWardrobe,
  buildOutfitPrompt,
  OCCASION_RULES,
} from './outfits.generator';
import { WardrobeItem } from '../wardrobe/schemas/wardrobe-item.schema';
import { AIService } from '../ai/ai.service';

function makeGarment(overrides: Partial<{
  _id: string;
  occasions: string[];
  style: string;
  category: string;
  type: string;
  color: string;
}> = {}) {
  return {
    _id: overrides._id ?? `id-${Math.random().toString(36).slice(2)}`,
    occasions: overrides.occasions ?? [],
    style: overrides.style as string | undefined,
    category: overrides.category ?? 'top',
    type: overrides.type ?? 'top',
    color: overrides.color ?? 'black',
  };
}

describe('preFilterWardrobe', () => {
  it('returns empty array for empty wardrobe', () => {
    expect(preFilterWardrobe([], 'gym')).toEqual([]);
  });

  it('filters gym: sport items pass, formal items excluded', () => {
    const wardrobe = [
      ...Array.from({ length: 10 }, (_, i) => makeGarment({ _id: `sport-${i}`, occasions: ['gym', 'sport'], category: 'top' })),
      ...Array.from({ length: 10 }, (_, i) => makeGarment({ _id: `formal-${i}`, occasions: ['formal', 'work'], style: 'formal', category: 'top' })),
      ...Array.from({ length: 10 }, (_, i) => makeGarment({ _id: `casual-${i}`, occasions: ['casual'], category: 'bottom' })),
    ];

    const filtered = preFilterWardrobe(wardrobe, 'gym');
    const formalIds = filtered.map((g) => String(g._id)).filter((id) => id.startsWith('formal'));
    expect(formalIds).toHaveLength(0);
  });

  it('returns full wardrobe when fewer than 5 garments have fine attributes', () => {
    const wardrobe = Array.from({ length: 20 }, (_, i) =>
      makeGarment({ _id: `plain-${i}`, occasions: [], category: 'top' }),
    );

    const result = preFilterWardrobe(wardrobe, 'gym');
    expect(result.length).toBe(wardrobe.length);
  });

  it('fallback to category filter when primary filter yields < 4 garments', () => {
    const withFineAttrs = Array.from({ length: 8 }, (_, i) =>
      makeGarment({ _id: `fine-${i}`, occasions: ['casual'], category: 'top' }),
    );
    const gymItems = [
      makeGarment({ _id: 'gym-1', occasions: ['gym'], category: 'top' }),
      makeGarment({ _id: 'gym-2', occasions: ['gym'], category: 'bottom' }),
    ];
    const wardrobe = [...withFineAttrs, ...gymItems];

    const result = preFilterWardrobe(wardrobe, 'gym');
    expect(result.length).toBeGreaterThan(0);
  });

  it('excludes garments with excludeOccasions when wardrobe is large enough', () => {
    const wardrobe = [
      ...Array.from({ length: 10 }, (_, i) => makeGarment({ _id: `sport-${i}`, occasions: ['gym'], category: 'top' })),
      ...Array.from({ length: 3 }, (_, i) => makeGarment({ _id: `party-${i}`, occasions: ['party', 'gala'], style: 'formal', category: 'top' })),
    ];

    const result = preFilterWardrobe(wardrobe, 'gym');
    const partyIds = result.map((g) => String(g._id)).filter((id) => id.startsWith('party'));
    expect(partyIds).toHaveLength(0);
  });
});

describe('buildOutfitPrompt', () => {
  const baseInput = {
    occasion: 'gym',
    weatherDescription: 'sunny',
    tempCelsius: 22,
    tempFeelsLike: 21,
    timeOfDay: 'mañana',
    dayOfWeek: 'Lunes',
    filteredWardrobe: [makeGarment({ _id: 'g1', occasions: ['gym'], category: 'top', color: 'black' })],
  };

  it('includes the correct occasion description for gym', () => {
    const prompt = buildOutfitPrompt(baseInput);
    expect(prompt).toContain('gym');
    expect(prompt).toContain(OCCASION_RULES['gym'].description);
  });

  it('includes the gym rules block', () => {
    const prompt = buildOutfitPrompt(baseInput);
    expect(prompt).toContain('PRIORIZAR: prendas sport/athletic');
  });

  it('does NOT include cold weather override when temp >= 10°C', () => {
    const prompt = buildOutfitPrompt({ ...baseInput, tempCelsius: 22 });
    expect(prompt).not.toContain('CLIMA FRÍO');
  });

  it('includes cold weather override when temp < 10°C', () => {
    const prompt = buildOutfitPrompt({ ...baseInput, tempCelsius: 5 });
    expect(prompt).toContain('CLIMA FRÍO');
    expect(prompt).toContain('5°C');
  });

  it('includes calendar event when provided', () => {
    const prompt = buildOutfitPrompt({ ...baseInput, calendarEvent: 'Reunión con cliente' });
    expect(prompt).toContain('Reunión con cliente');
  });

  it('does NOT include calendar line when calendarEvent is absent', () => {
    const prompt = buildOutfitPrompt({ ...baseInput, calendarEvent: undefined });
    expect(prompt).not.toContain('Evento de hoy');
  });

  it('generates different rules block for work vs gym', () => {
    const gymPrompt = buildOutfitPrompt({ ...baseInput, occasion: 'gym' });
    const workPrompt = buildOutfitPrompt({ ...baseInput, occasion: 'work' });
    expect(gymPrompt).toContain('sport/athletic');
    expect(workPrompt).toContain('smart-casual');
    expect(gymPrompt).not.toBe(workPrompt);
  });

  it('falls back to casual rules for unknown occasion', () => {
    const prompt = buildOutfitPrompt({ ...baseInput, occasion: 'unknown-occasion' });
    expect(prompt).toContain(OCCASION_RULES['casual'].description);
  });
});

describe('OutfitsGenerator', () => {
  let generator: OutfitsGenerator;
  let mockItemModel: { find: jest.Mock };
  let mockAiService: { generateTextContent: jest.Mock };

  const userId = new Types.ObjectId().toString();

  beforeEach(async () => {
    mockItemModel = { find: jest.fn() };
    mockAiService = { generateTextContent: jest.fn().mockRejectedValue(new Error('AI unavailable')) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutfitsGenerator,
        { provide: getModelToken(WardrobeItem.name), useValue: mockItemModel },
        { provide: AIService, useValue: mockAiService },
      ],
    }).compile();

    generator = module.get<OutfitsGenerator>(OutfitsGenerator);
  });

  it('should be defined', () => {
    expect(generator).toBeDefined();
  });

  it('falls back to random selection when AI fails', async () => {
    const mockItems = [
      { _id: new Types.ObjectId(), category: 'top', type: 'top', status: 'ready', occasions: ['casual'] },
      { _id: new Types.ObjectId(), category: 'bottom', type: 'bottom', status: 'ready', occasions: ['casual'] },
    ];
    mockItemModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockItems) });

    const result = await generator.compose(userId, 'casual', undefined, undefined, null);
    expect(result.items.length).toBeGreaterThanOrEqual(0);
    expect(result.aiModel).toContain('fallback');
  });

  it('returns empty outfit when no items available', async () => {
    mockItemModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    const result = await generator.compose(userId, 'casual', undefined, undefined, null);
    expect(result.items).toHaveLength(0);
  });

  it('uses AI response when available', async () => {
    const id1 = new Types.ObjectId();
    const id2 = new Types.ObjectId();
    const mockItems = [
      { _id: id1, category: 'top', type: 'top', status: 'ready', occasions: ['gym'] },
      { _id: id2, category: 'bottom', type: 'bottom', status: 'ready', occasions: ['gym'] },
    ];
    mockItemModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockItems) });
    mockAiService.generateTextContent.mockResolvedValue(
      JSON.stringify({ items: [String(id1), String(id2)], reasoning: 'Great gym outfit' }),
    );

    const result = await generator.compose(userId, 'gym', undefined, undefined, null);
    expect(result.aiModel).toBe('gemini-2.5-flash-outfit-v2');
    expect(result.justification).toBe('Great gym outfit');
    expect(result.items.length).toBe(2);
  });
});
