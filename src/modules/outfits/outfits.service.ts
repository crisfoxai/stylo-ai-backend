import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

function assertObjectId(value: string, field = 'id'): void {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException({ error: 'INVALID_ID', field });
  }
}
import { Outfit, OutfitDocument } from './schemas/outfit.schema';
import { FavoriteOutfit, FavoriteOutfitDocument } from './schemas/favorite-outfit.schema';
import { WornEntry, WornEntryDocument } from './schemas/worn-entry.schema';
import { GenerateOutfitDto, OutfitHistoryDto } from './dto/outfit.dto';
import { OutfitsGenerator } from './outfits.generator';
import { WeatherService } from '../weather/weather.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class OutfitsService {
  constructor(
    @InjectModel(Outfit.name) private readonly outfitModel: Model<OutfitDocument>,
    @InjectModel(FavoriteOutfit.name) private readonly favoriteModel: Model<FavoriteOutfitDocument>,
    @InjectModel(WornEntry.name) private readonly wornModel: Model<WornEntryDocument>,
    private readonly generator: OutfitsGenerator,
    private readonly weatherService: WeatherService,
    private readonly usersService: UsersService,
  ) {}

  async generate(userId: string, dto: GenerateOutfitDto): Promise<OutfitDocument> {
    const weather =
      dto.lat !== undefined && dto.lon !== undefined
        ? await this.weatherService.getByLocation(dto.lat, dto.lon)
        : undefined;

    const styleProfile = await this.usersService.getStyleProfile(userId);
    const composition = await this.generator.compose(
      userId,
      dto.occasion,
      dto.mood,
      weather,
      styleProfile,
      dto.excludeIds,
    );

    const outfitDoc = await this.outfitModel.create({
      userId: new Types.ObjectId(userId),
      occasion: dto.occasion,
      mood: dto.mood,
      weatherContext: weather,
      items: composition.items,
      aiModel: composition.aiModel,
    });

    const base = typeof (outfitDoc as unknown as { toJSON?: () => object }).toJSON === 'function'
      ? (outfitDoc as unknown as { toJSON: () => object }).toJSON()
      : { ...outfitDoc };

    return {
      ...base,
      id: String(outfitDoc._id),
      name: 'Outfit generado',
      garments: composition.garments,
    } as unknown as OutfitDocument;
  }

  async addFavorite(userId: string, outfitId: string): Promise<void> {
    await this.favoriteModel.updateOne(
      { userId: new Types.ObjectId(userId), outfitId: new Types.ObjectId(outfitId) },
      { $setOnInsert: { userId: new Types.ObjectId(userId), outfitId: new Types.ObjectId(outfitId) } },
      { upsert: true },
    );
  }

  async removeFavorite(userId: string, outfitId: string): Promise<void> {
    await this.favoriteModel.deleteOne({
      userId: new Types.ObjectId(userId),
      outfitId: new Types.ObjectId(outfitId),
    });
  }

  async getFavorites(userId: string): Promise<FavoriteOutfitDocument[]> {
    return this.favoriteModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('outfitId')
      .lean() as unknown as FavoriteOutfitDocument[];
  }

  async markWorn(userId: string, outfitId: string): Promise<WornEntryDocument> {
    assertObjectId(outfitId, 'outfitId');
    const outfit = await this.outfitModel.findOne({
      _id: new Types.ObjectId(outfitId),
      userId: new Types.ObjectId(userId),
    });
    if (!outfit) throw new NotFoundException({ error: 'NOT_FOUND' });

    return this.wornModel.create({
      userId: new Types.ObjectId(userId),
      outfitId: new Types.ObjectId(outfitId),
      wornDate: new Date(),
    });
  }

  async findOne(userId: string, outfitId: string): Promise<Record<string, unknown>> {
    assertObjectId(outfitId, 'outfitId');
    const outfit = await this.outfitModel.findOne({
      _id: new Types.ObjectId(outfitId),
      userId: new Types.ObjectId(userId),
    }).lean();

    if (!outfit) throw new NotFoundException({ error: 'NOT_FOUND' });

    const garments = await this.generator.populateGarments(outfit.items as { wardrobeItemId: Types.ObjectId; slot: string }[]);
    return { ...outfit, id: String(outfit._id), name: 'Outfit', garments };
  }

  async listByUser(userId: string, page = 1, limit = 20): Promise<OutfitDocument[]> {
    const skip = (page - 1) * limit;
    return this.outfitModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean() as unknown as OutfitDocument[];
  }

  async getHistory(userId: string, dto: OutfitHistoryDto): Promise<WornEntryDocument[]> {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };

    if (dto.month) {
      const [year, month] = dto.month.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      filter['wornDate'] = { $gte: start, $lt: end };
    }

    return this.wornModel.find(filter).sort({ wornDate: -1 }).lean() as unknown as WornEntryDocument[];
  }
}
